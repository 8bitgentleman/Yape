import { decodeBase64Url, extractUrlsWithBase64 } from '../base64Url';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const URL1 = 'https://example.com/files/archive.part1.rar';
const URL2 = 'http://example.org/a?b=c&d=é';

describe('decodeBase64Url', () => {
  it('decodes a single layer', () => {
    expect(decodeBase64Url(b64(URL1))).toBe(URL1);
  });

  it('decodes a double layer', () => {
    expect(decodeBase64Url(b64(b64(URL1)))).toBe(URL1);
  });

  it('does not decode a third layer', () => {
    expect(decodeBase64Url(b64(b64(b64(URL1))))).toBeNull();
  });

  it('handles URL-safe alphabet and missing padding', () => {
    const urlSafe = b64('https://example.com/a?x=>>>???').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Url(urlSafe)).toBe('https://example.com/a?x=>>>???');
  });

  it('handles UTF-8', () => {
    expect(decodeBase64Url(b64(URL2))).toBe(URL2);
  });

  it('tolerates surrounding whitespace and embedded line breaks', () => {
    const e = b64(URL1);
    expect(decodeBase64Url(`  ${e.slice(0, 10)}\n${e.slice(10)}  `)).toBe(URL1);
  });

  it('rejects base64 that is not a URL', () => {
    expect(decodeBase64Url(b64('hello world'))).toBeNull();
    expect(decodeBase64Url(b64('javascript:alert(1)'))).toBeNull();
  });

  it('rejects invalid or empty input', () => {
    expect(decodeBase64Url('')).toBeNull();
    expect(decodeBase64Url('not base64!!')).toBeNull();
    expect(decodeBase64Url('download')).toBeNull();
    expect(decodeBase64Url('A')).toBeNull();
  });

  it('rejects oversized input', () => {
    expect(decodeBase64Url('A'.repeat(20000))).toBeNull();
  });
});

describe('extractUrlsWithBase64', () => {
  it('prefers plain URLs and does not decode', () => {
    expect(extractUrlsWithBase64(`see ${URL1} thanks`)).toEqual({ urls: [URL1], decoded: false });
  });

  it('decodes a base64 blob when there are no plain URLs', () => {
    expect(extractUrlsWithBase64(b64(URL1))).toEqual({ urls: [URL1], decoded: true });
  });

  it('decodes several blobs, one per line, without duplicates', () => {
    const text = `${b64(URL1)}\n${b64(b64(URL2))}\n${b64(URL1)}`;
    expect(extractUrlsWithBase64(text)).toEqual({ urls: [URL1, URL2], decoded: true });
  });

  it('decodes a blob that was wrapped across lines', () => {
    const e = b64(URL1);
    expect(extractUrlsWithBase64(`${e.slice(0, 12)}\n${e.slice(12)}`)).toEqual({ urls: [URL1], decoded: true });
  });

  it('returns nothing for ordinary text', () => {
    expect(extractUrlsWithBase64('just some words here')).toEqual({ urls: [], decoded: false });
  });
});
