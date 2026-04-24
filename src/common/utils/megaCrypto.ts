import * as aesjs from 'aes-js';

export function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function bin2i32a(bytes: Uint8Array): number[] {
  const result: number[] = [];
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    result.push(
      (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]
    );
  }
  return result;
}

function i32a2bin(ints: number[]): Uint8Array {
  const result = new Uint8Array(ints.length * 4);
  for (let i = 0; i < ints.length; i++) {
    const v = ints[i];
    result[i * 4]     = (v >>> 24) & 0xff;
    result[i * 4 + 1] = (v >>> 16) & 0xff;
    result[i * 4 + 2] = (v >>>  8) & 0xff;
    result[i * 4 + 3] =  v         & 0xff;
  }
  return result;
}

/**
 * Decodes a folder key from a MEGA folder link.
 * 16 bytes → use directly; 32 bytes → XOR halves.
 */
export function decodeFolderKey(keyString: string): Uint8Array | null {
  const raw = base64urlDecode(keyString);
  if (raw.length === 16) return raw;
  if (raw.length === 32) {
    const ints = bin2i32a(raw);
    if (ints.length < 8) return null;
    return i32a2bin([
      ints[0] ^ ints[4],
      ints[1] ^ ints[5],
      ints[2] ^ ints[6],
      ints[3] ^ ints[7],
    ]);
  }
  return null;
}

/** Derives the 16-byte AES key from a MEGA 32-byte link key string. */
export function initMEGALinkKey(keyString: string): Uint8Array | null {
  const raw = base64urlDecode(keyString);
  const ints = bin2i32a(raw);
  if (ints.length < 8) return null;
  return i32a2bin([
    ints[0] ^ ints[4],
    ints[1] ^ ints[5],
    ints[2] ^ ints[6],
    ints[3] ^ ints[7],
  ]);
}

/** AES-128-ECB decrypt (no padding). Used to decrypt folder node keys. */
export function decryptAESECB(data: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (key.length !== 16 || data.length === 0 || data.length % 16 !== 0) return null;
  try {
    const aesEcb = new aesjs.ModeOfOperation.ecb(key);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 16) {
      const decrypted = aesEcb.decrypt(data.slice(i, i + 16));
      result.set(decrypted, i);
    }
    return result;
  } catch {
    return null;
  }
}

/** AES-128-CBC decrypt (no padding). Zero IV for attribute decryption. */
export function decryptAESCBC(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array | null {
  if (key.length !== 16 || iv.length !== 16 || data.length === 0 || data.length % 16 !== 0) return null;
  try {
    const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
    return Uint8Array.from(aesCbc.decrypt(data));
  } catch {
    return null;
  }
}

/**
 * Decrypts a MEGA node's base64url-encoded attributes.
 * AES-CBC (zero IV, no padding), strip trailing NULs, strip "MEGA" prefix, parse JSON.
 */
export function decryptAttributes(encAttr: string, key: Uint8Array): Record<string, unknown> | null {
  const ciphertext = base64urlDecode(encAttr);
  const decrypted = decryptAESCBC(ciphertext, key, new Uint8Array(16));
  if (!decrypted) return null;

  let end = decrypted.length;
  while (end > 0 && decrypted[end - 1] === 0) end--;
  if (end === 0) return null;

  let attrString = new TextDecoder().decode(decrypted.slice(0, end));
  if (attrString.startsWith('MEGA')) attrString = attrString.slice(4);

  try {
    return JSON.parse(attrString) as Record<string, unknown>;
  } catch {
    return null;
  }
}
