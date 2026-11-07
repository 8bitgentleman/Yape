import * as aesjs from 'aes-js';
import {
  base64urlDecode,
  uint8ArrayToBase64url,
  decodeFolderKey,
  initMEGALinkKey,
  decryptAESECB,
  decryptAESCBC,
  decryptAttributes,
} from '../megaCrypto';

const range = (start: number, length: number) =>
  Uint8Array.from({ length }, (_, i) => (start + i) & 0xff);

describe('base64url', () => {
  it('round-trips bytes that use the url-safe characters', () => {
    const data = Uint8Array.from([0xfb, 0xff, 0xbf, 0x00, 0x01]);
    const encoded = uint8ArrayToBase64url(data);
    expect(encoded).toBe('-_-_AAE');
    expect(base64urlDecode(encoded)).toEqual(data);
  });

  it('decodes strings without padding', () => {
    expect(base64urlDecode('YQ')).toEqual(Uint8Array.from([0x61]));
  });
});

describe('decodeFolderKey', () => {
  it('uses a 16-byte key as-is', () => {
    const key = range(0, 16);
    expect(decodeFolderKey(uint8ArrayToBase64url(key))).toEqual(key);
  });

  it('XORs the halves of a 32-byte key', () => {
    const key = range(0, 32);
    const expected = Uint8Array.from({ length: 16 }, (_, i) => key[i] ^ key[i + 16]);
    expect(decodeFolderKey(uint8ArrayToBase64url(key))).toEqual(expected);
  });

  it('rejects other lengths', () => {
    expect(decodeFolderKey(uint8ArrayToBase64url(range(0, 8)))).toBeNull();
  });
});

describe('initMEGALinkKey', () => {
  it('XORs the halves of a 32-byte file key', () => {
    const key = range(100, 32);
    const expected = Uint8Array.from({ length: 16 }, (_, i) => key[i] ^ key[i + 16]);
    expect(initMEGALinkKey(uint8ArrayToBase64url(key))).toEqual(expected);
  });

  it('rejects keys shorter than 32 bytes', () => {
    expect(initMEGALinkKey(uint8ArrayToBase64url(range(0, 16)))).toBeNull();
  });
});

describe('AES helpers', () => {
  const key = range(5, 16);

  it('decryptAESECB reverses ECB encryption block by block', () => {
    const plain = range(40, 32);
    const ecb = new aesjs.ModeOfOperation.ecb(key);
    const cipher = new Uint8Array(32);
    cipher.set(ecb.encrypt(plain.slice(0, 16)), 0);
    cipher.set(ecb.encrypt(plain.slice(16)), 16);
    expect(decryptAESECB(cipher, key)).toEqual(plain);
  });

  it('decryptAESECB rejects bad sizes', () => {
    expect(decryptAESECB(range(0, 15), key)).toBeNull();
    expect(decryptAESECB(new Uint8Array(0), key)).toBeNull();
    expect(decryptAESECB(range(0, 16), range(0, 8))).toBeNull();
  });

  it('decryptAESCBC rejects bad sizes', () => {
    expect(decryptAESCBC(range(0, 16), key, range(0, 8))).toBeNull();
    expect(decryptAESCBC(range(0, 17), key, new Uint8Array(16))).toBeNull();
  });
});

describe('decryptAttributes', () => {
  const key = range(9, 16);
  const encrypt = (text: string) => {
    const plain = new TextEncoder().encode(text);
    const padded = new Uint8Array(Math.ceil(plain.length / 16) * 16);
    padded.set(plain);
    const cbc = new aesjs.ModeOfOperation.cbc(key, new Uint8Array(16));
    return uint8ArrayToBase64url(Uint8Array.from(cbc.encrypt(padded)));
  };

  it('strips the MEGA prefix and NUL padding, then parses JSON', () => {
    expect(decryptAttributes(encrypt('MEGA{"n":"Ünïcödé file.mkv"}'), key)).toEqual({ n: 'Ünïcödé file.mkv' });
  });

  it('returns null when decrypted with the wrong key', () => {
    expect(decryptAttributes(encrypt('MEGA{"n":"x"}'), range(200, 16))).toBeNull();
  });
});
