import * as aesjs from 'aes-js';
import { getFolderContents, isMegaFolderLink } from '../megaFolder';
import { uint8ArrayToBase64url } from '../../utils/megaCrypto';

// ── Fixture helpers: build an encrypted MEGA folder listing offline ─────────

const b64 = uint8ArrayToBase64url;

function bytes(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (seed * 31 + i * 7) & 0xff;
  return out;
}

function xorHalves(key32: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = key32[i] ^ key32[i + 16];
  return out;
}

function encryptECB(data: Uint8Array, key: Uint8Array): string {
  const ecb = new aesjs.ModeOfOperation.ecb(key);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 16) out.set(ecb.encrypt(data.slice(i, i + 16)), i);
  return b64(out);
}

function encryptAttrs(attrs: object, key: Uint8Array): string {
  const plain = new TextEncoder().encode('MEGA' + JSON.stringify(attrs));
  const padded = new Uint8Array(Math.ceil(plain.length / 16) * 16);
  padded.set(plain);
  const cbc = new aesjs.ModeOfOperation.cbc(key, new Uint8Array(16));
  return b64(Uint8Array.from(cbc.encrypt(padded)));
}

const FOLDER_ID = 'AbCdEfGh';
const FOLDER_KEY = bytes(1, 16);
const OTHER_SHARE_KEY = bytes(99, 16);

type KeyLayout = 'single' | 'rootFirst' | 'rootLast' | 'nonRootHandle';

/** Formats a node's `k` field, optionally adding an unrelated share's entry. */
function keyField(rootHandle: string, nodeKey: Uint8Array, layout: KeyLayout): string {
  const good = encryptECB(nodeKey, FOLDER_KEY);
  const other = `PARENTSH:${encryptECB(nodeKey, OTHER_SHARE_KEY)}`;
  switch (layout) {
    case 'single': return `${rootHandle}:${good}`;
    case 'rootFirst': return `${rootHandle}:${good}/${other}`;
    case 'rootLast': return `${other}/${rootHandle}:${good}`;
    case 'nonRootHandle': return `ZZZZZZZZ:${good}`;
  }
}

/**
 * Root folder "Show" containing "a.mkv" and subfolder "Season 1" with "b.mkv".
 * The root's parent is outside the share, like a real MEGA folder link.
 */
function buildListing(layout: KeyLayout) {
  const folderNode = (h: string, p: string, name: string, seed: number) => {
    const key = bytes(seed, 16);
    return { h, p, t: 1, a: encryptAttrs({ n: name }, key), k: keyField('ROOTHNDL', key, layout), ts: 0 };
  };
  const fileNode = (h: string, p: string, name: string, seed: number, s: number) => {
    const key = bytes(seed, 32);
    return { h, p, t: 0, s, a: encryptAttrs({ n: name }, xorHalves(key)), k: keyField('ROOTHNDL', key, layout), ts: 0 };
  };
  return [
    folderNode('ROOTHNDL', 'OUTSIDE1', 'Show', 10),
    folderNode('SUBHNDL1', 'ROOTHNDL', 'Season 1', 11),
    fileNode('FILEHND1', 'ROOTHNDL', 'a.mkv', 20, 1000),
    fileNode('FILEHND2', 'SUBHNDL1', 'b.mkv', 21, 2000),
  ];
}

function mockFetch(payload: unknown) {
  const fn = jest.fn().mockResolvedValue({ json: async () => payload });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const LINK = `https://mega.nz/folder/${FOLDER_ID}#${b64(FOLDER_KEY)}`;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('isMegaFolderLink', () => {
  it.each([
    'https://mega.nz/folder/I3oD3I7b#R-hvvuwEHIp8vGyPvc82_w',
    '  https://mega.nz/folder/I3oD3I7b#R-hvvuwEHIp8vGyPvc82_w  ',
  ])('accepts folder link %s', url => {
    expect(isMegaFolderLink(url)).toBe(true);
  });

  it.each([
    'https://mega.nz/file/I3oD3I7b#R-hvvuwEHIp8vGyPvc82_w',
    'https://mega.nz/folder/I3oD3I7b#R-hvvuwEHIp8vGyPvc82_w/file/FILEHND1',
    'https://mega.nz/folder/I3oD3I7b',
    'https://example.com/download.zip',
  ])('rejects non-folder link %s', url => {
    expect(isMegaFolderLink(url)).toBe(false);
  });

  it('accepts links to a subfolder inside a shared folder', () => {
    expect(isMegaFolderLink('https://mega.nz/folder/I3oD3I7b#R-hvvuwEHIp8vGyPvc82_w/folder/SUBHNDL1')).toBe(true);
  });
});

describe('getFolderContents', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  const expectedFiles = (folderKeyStr: string) => [
    {
      handle: 'FILEHND1',
      fileName: 'a.mkv',
      fileSize: 1000,
      fileKey: b64(bytes(20, 32)),
      relativePath: 'Show',
      link: `https://mega.nz/folder/${FOLDER_ID}#${folderKeyStr}/file/FILEHND1`,
    },
    {
      handle: 'FILEHND2',
      fileName: 'b.mkv',
      fileSize: 2000,
      fileKey: b64(bytes(21, 32)),
      relativePath: 'Show/Season 1',
      link: `https://mega.nz/folder/${FOLDER_ID}#${folderKeyStr}/file/FILEHND2`,
    },
  ];

  it('decodes a regular folder (one key per node)', async () => {
    const fetchMock = mockFetch([{ f: buildListing('single') }]);
    await expect(getFolderContents(LINK)).resolves.toEqual(expectedFiles(b64(FOLDER_KEY)));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`^https://g\\.api\\.mega\\.co\\.nz/cs\\?id=\\d+&n=${FOLDER_ID}$`));
    expect(JSON.parse(init.body)).toEqual([{ a: 'f', c: '1', r: '1', ca: '1' }]);
  });

  it.each<KeyLayout>(['rootFirst', 'rootLast'])(
    'picks the shared root key when nodes list several shares (%s)',
    async layout => {
      mockFetch([{ f: buildListing(layout) }]);
      await expect(getFolderContents(LINK)).resolves.toEqual(expectedFiles(b64(FOLDER_KEY)));
    },
  );

  it('falls back to any entry that decrypts when no handle matches the root', async () => {
    mockFetch([{ f: buildListing('nonRootHandle') }]);
    await expect(getFolderContents(LINK)).resolves.toEqual(expectedFiles(b64(FOLDER_KEY)));
  });

  it('accepts a 32-byte folder key in the link', async () => {
    const mask = bytes(7, 16);
    const longKey = new Uint8Array(32);
    for (let i = 0; i < 16; i++) {
      longKey[i] = FOLDER_KEY[i] ^ mask[i];
      longKey[i + 16] = mask[i];
    }
    const longKeyStr = b64(longKey);
    mockFetch([{ f: buildListing('single') }]);
    await expect(
      getFolderContents(`https://mega.nz/folder/${FOLDER_ID}#${longKeyStr}`),
    ).resolves.toEqual(expectedFiles(longKeyStr));
  });

  it('skips nodes whose keys cannot be decrypted with the link key', async () => {
    const wrongKeyLink = `https://mega.nz/folder/${FOLDER_ID}#${b64(bytes(50, 16))}`;
    mockFetch([{ f: buildListing('single') }]);
    await expect(getFolderContents(wrongKeyLink)).resolves.toEqual([]);
  });

  it('returns an empty list for an empty folder', async () => {
    mockFetch([{ f: [] }]);
    await expect(getFolderContents(LINK)).resolves.toEqual([]);
  });

  it('throws on MEGA API error codes', async () => {
    mockFetch([-9]);
    await expect(getFolderContents(LINK)).rejects.toThrow('MEGA API error: -9');
  });

  it('throws on links without a folder key', async () => {
    await expect(getFolderContents('https://mega.nz/folder/AbCdEfGh')).rejects.toThrow('Invalid MEGA folder link');
  });

  it('throws when the folder key has an unsupported length', async () => {
    await expect(getFolderContents('https://mega.nz/folder/AbCdEfGh#AAAA')).rejects.toThrow('Failed to decode folder key');
  });
});
