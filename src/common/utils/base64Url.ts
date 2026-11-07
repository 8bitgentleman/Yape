/**
 * Base64-encoded URL detection.
 *
 * Some sites publish download links as base64 text (sometimes encoded twice).
 * These helpers decode such text and return it only when the result is a
 * valid URL. Pure functions, no platform dependencies (works in a browser
 * page, a service worker, React Native and Node).
 *
 * Keep this file identical in the Yape and Yape_mobile repos.
 */

// Decoded output larger than this is rejected (a URL never needs more).
const MAX_DECODED_SIZE = 10_000;
// Largest base64 string we will attempt (4 chars per 3 bytes).
const MAX_ENCODED_SIZE = Math.ceil((MAX_DECODED_SIZE * 4) / 3) + 4;
const MAX_LAYERS = 2;

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const BASE64_CHARS = /^[A-Za-z0-9+/_-]+={0,2}$/;

function isHttpUrl(text: string): boolean {
  if (!/^(https?|ftp):\/\//i.test(text)) return false;
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/** Decode one base64 layer (standard or URL-safe alphabet) to a UTF-8 string. */
function decodeLayer(input: string): string | null {
  const compact = input.replace(/\s+/g, '');
  if (compact.length === 0 || compact.length > MAX_ENCODED_SIZE) return null;
  if (!BASE64_CHARS.test(compact)) return null;

  let normalized = compact.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (normalized.length % 4 === 1) return null; // impossible base64 length
  while (normalized.length % 4 !== 0) normalized += '=';

  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    return null;
  }
  if (binary.length > MAX_DECODED_SIZE) return null;

  // Interpret the bytes as UTF-8 without relying on TextDecoder (missing on some RN runtimes).
  try {
    let escaped = '';
    for (let i = 0; i < binary.length; i++) {
      escaped += '%' + binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return decodeURIComponent(escaped);
  } catch {
    return null;
  }
}

/**
 * Decode a base64 string (one or two layers) to a URL.
 * Returns null unless the result is a valid http(s)/ftp URL.
 */
export function decodeBase64Url(text: string): string | null {
  let current = text.trim();
  for (let layer = 0; layer < MAX_LAYERS; layer++) {
    const decoded = decodeLayer(current);
    if (decoded === null) return null;
    current = decoded.trim();
    if (isHttpUrl(current)) return current;
  }
  return null;
}

/**
 * Extract downloadable URLs from free text.
 * Plain URLs win; only when there are none do we try to decode base64 tokens
 * (whitespace-separated, or the whole text as one blob wrapped across lines).
 * `decoded` tells the caller whether base64 decoding was needed.
 */
export function extractUrlsWithBase64(text: string): { urls: string[]; decoded: boolean } {
  const plain = text.match(URL_REGEX);
  if (plain && plain.length > 0) return { urls: plain, decoded: false };

  const tokens = text.split(/\s+/).filter(Boolean);
  const individual = tokens.map((token) => decodeBase64Url(token));

  let found: string[];
  if (individual.every((u) => u !== null)) {
    // Every token is its own encoded URL
    found = individual as string[];
  } else {
    // Some tokens are not URLs. The text may be one blob wrapped across lines
    // (a fragment of a blob can itself decode to a bogus URL prefix, so try the
    // whole thing first), otherwise keep whichever tokens did decode.
    const joined = tokens.length > 1 ? decodeBase64Url(tokens.join('')) : null;
    found = joined ? [joined] : (individual.filter((u) => u !== null) as string[]);
  }
  found = found.filter((u, i) => found.indexOf(u) === i);

  return { urls: found, decoded: found.length > 0 };
}
