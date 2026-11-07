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

const DECODED_URL_REGEX = /(?:https?|ftp):\/\/[^\s<>"{}|\\^`[\]]+/gi;

function isValidUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/** All valid http(s)/ftp URLs found anywhere in `text`, de-duplicated, in order. */
function findUrls(text: string): string[] {
  const matches: string[] = text.match(DECODED_URL_REGEX) || [];
  return matches.filter((u, i) => isValidUrl(u) && matches.indexOf(u) === i);
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
 * Decode a base64 string (one or two layers) and return every http(s)/ftp URL
 * found in the decoded text. The decoded text may hold several links, or links
 * mixed with other text (titles, passwords, notes): the text is ignored and
 * only the URLs are returned. Returns [] when nothing decodes to a URL.
 */
export function decodeBase64Urls(text: string): string[] {
  let current = text.trim();
  for (let layer = 0; layer < MAX_LAYERS; layer++) {
    const decoded = decodeLayer(current);
    if (decoded === null) return [];
    const urls = findUrls(decoded);
    if (urls.length > 0) return urls;
    current = decoded.trim(); // maybe another layer of base64
  }
  return [];
}

const unique = (urls: string[]) => urls.filter((u, i) => urls.indexOf(u) === i);

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
  const perToken = tokens.map((token) => decodeBase64Urls(token));

  // A blob copied from an email or terminal is usually wrapped at a fixed width:
  // every line the same length, the last one no longer.
  const looksWrapped =
    tokens.length > 1 &&
    tokens.slice(0, -1).every((t) => t.length === tokens[0].length) &&
    tokens[tokens.length - 1].length <= tokens[0].length;
  const allDecode = perToken.every((urls) => urls.length > 0);

  // A fragment of a blob can itself decode to a bogus URL prefix, so when the
  // text may be one wrapped blob, try the whole thing before the pieces.
  const joined = tokens.length > 1 && (!allDecode || looksWrapped) ? decodeBase64Urls(tokens.join('')) : [];
  // Two separate blobs glued together decode to "urlAurlB": reject that.
  const joinedOk = joined.length > 0 && !joined.some((u) => u.indexOf('://') !== u.lastIndexOf('://'));

  let found: string[] = joinedOk ? joined : perToken.flat();
  found = unique(found);

  return { urls: found, decoded: found.length > 0 };
}
