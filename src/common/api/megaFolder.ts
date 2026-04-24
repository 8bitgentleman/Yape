import {
  base64urlDecode,
  uint8ArrayToBase64url,
  decodeFolderKey,
  initMEGALinkKey,
  decryptAESECB,
  decryptAttributes,
} from '../utils/megaCrypto';

const MEGA_API = 'https://g.api.mega.co.nz';
let seqno = Math.floor(Math.random() * 0x10000);
const nextSeqno = () => seqno++;

export interface FolderFile {
  handle: string;
  fileName: string;
  fileSize: number;
  fileKey: string;
  relativePath: string;
  link: string;
}

/** Returns true if the URL is a bare MEGA folder link (no /file/ suffix). */
export function isMegaFolderLink(url: string): boolean {
  return /\/folder\/[^#]+#[^/]+$/.test(url.trim());
}

interface RawNode {
  h: string;
  p: string;
  t: number;
  s: number;
  a: string;
  k: string;
}

async function megaApiPost(url: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json() as unknown[];
  const first = json[0];
  if (typeof first === 'number' && first < 0) {
    throw new Error(`MEGA API error: ${first}`);
  }
  return first as Record<string, unknown>;
}

/** Fetches and decrypts all file nodes from a MEGA folder link. */
export async function getFolderContents(link: string): Promise<FolderFile[]> {
  const match = link.match(/\/folder\/([^#]+)#([^/]+)/);
  if (!match) throw new Error('Invalid MEGA folder link');

  const folderID = match[1];
  const folderKeyStr = match[2];

  const folderKey = decodeFolderKey(folderKeyStr);
  if (!folderKey) throw new Error('Failed to decode folder key');

  const url = `${MEGA_API}/cs?id=${nextSeqno()}&n=${folderID}`;
  const resp = await megaApiPost(url, [{ a: 'f', c: '1', r: '1', ca: '1' }]);

  const nodes = (resp['f'] ?? []) as RawNode[];
  const nodeMap = new Map<string, RawNode>();
  for (const node of nodes) {
    if (node.h) nodeMap.set(node.h, node);
  }

  const folderNames = new Map<string, string>();
  for (const [handle, node] of nodeMap) {
    if (node.t !== 1 || !node.k || !node.a) continue;
    const keyParts = node.k.split(':');
    if (keyParts.length < 2) continue;
    const encKeyData = base64urlDecode(keyParts[keyParts.length - 1]);
    const decKeyData = decryptAESECB(encKeyData, folderKey);
    if (!decKeyData) continue;

    const attrKey = decKeyData.length === 16
      ? decKeyData
      : initMEGALinkKey(uint8ArrayToBase64url(decKeyData));
    if (!attrKey) continue;

    const attrs = decryptAttributes(node.a, attrKey);
    if (attrs && typeof attrs['n'] === 'string') {
      folderNames.set(handle, attrs['n']);
    }
  }

  function relativePath(handle: string): string {
    const parts: string[] = [];
    let current = handle;
    for (;;) {
      const node = nodeMap.get(current);
      if (!node) break;
      const parent = nodeMap.get(node.p);
      if (!parent || parent.t === 2) break;
      const name = folderNames.get(node.p);
      if (name) parts.unshift(name);
      current = node.p;
    }
    return parts.join('/');
  }

  const files: FolderFile[] = [];
  for (const [handle, node] of nodeMap) {
    if (node.t !== 0 || !node.k || !node.a) continue;
    const keyParts = node.k.split(':');
    if (keyParts.length < 2) continue;

    const encKeyData = base64urlDecode(keyParts[keyParts.length - 1]);
    const decKeyData = decryptAESECB(encKeyData, folderKey);
    if (!decKeyData) continue;

    const fileKeyB64 = uint8ArrayToBase64url(decKeyData);
    const aesKey = initMEGALinkKey(fileKeyB64);
    if (!aesKey) continue;

    const attrs = decryptAttributes(node.a, aesKey);
    if (!attrs || typeof attrs['n'] !== 'string') continue;

    files.push({
      handle,
      fileName: attrs['n'],
      fileSize: node.s ?? 0,
      fileKey: fileKeyB64,
      relativePath: relativePath(handle),
      link: `https://mega.nz/folder/${folderID}#${folderKeyStr}/file/${handle}`,
    });
  }

  files.sort((a, b) => {
    const pathCmp = a.relativePath.localeCompare(b.relativePath);
    return pathCmp !== 0 ? pathCmp : a.fileName.localeCompare(b.fileName);
  });

  return files;
}
