import { decodeBase64Urls, extractUrlsWithBase64 } from '../base64Url';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
// Wrap a string into fixed-width lines, like an email client or terminal would.
const wrap = (text: string, width: number) => text.match(new RegExp(`.{1,${width}}`, 'g'))!.join('\n');
const URL1 = 'https://example.com/files/archive.part1.rar';
const URL2 = 'http://example.org/a?b=c&d=é';

describe('decodeBase64Urls', () => {
  it('decodes a single layer', () => {
    expect(decodeBase64Urls(b64(URL1))).toEqual([URL1]);
  });

  it('decodes a double layer', () => {
    expect(decodeBase64Urls(b64(b64(URL1)))).toEqual([URL1]);
  });

  it('does not decode a third layer', () => {
    expect(decodeBase64Urls(b64(b64(b64(URL1))))).toEqual([]);
  });

  it('handles URL-safe alphabet and missing padding', () => {
    const urlSafe = b64('https://example.com/a?x=~~~???').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Urls(urlSafe)).toEqual(['https://example.com/a?x=~~~???']);
  });

  it('handles UTF-8', () => {
    expect(decodeBase64Urls(b64(URL2))).toEqual([URL2]);
  });

  it('tolerates surrounding whitespace and embedded line breaks', () => {
    const e = b64(URL1);
    expect(decodeBase64Urls(`  ${e.slice(0, 10)}\n${e.slice(10)}  `)).toEqual([URL1]);
  });

  it('returns every link in a multi-link blob', () => {
    expect(decodeBase64Urls(b64(`${URL1}\n${URL2}\r\n${URL1}`))).toEqual([URL1, URL2]);
  });

  it('extracts links from a blob that also contains text', () => {
    const blob = b64(`My release\n${URL1}  pw: s3cret\nmirror: ${URL2}\nenjoy!`);
    expect(decodeBase64Urls(blob)).toEqual([URL1, URL2]);
  });

  it('handles double-encoded multi-link text', () => {
    expect(decodeBase64Urls(b64(b64(`Links:\n${URL1}\n${URL2}`)))).toEqual([URL1, URL2]);
  });

  it('ignores non-web schemes inside a blob', () => {
    expect(decodeBase64Urls(b64(`javascript:alert(1) file:///etc/passwd ${URL1}`))).toEqual([URL1]);
  });

  it('rejects base64 that is not a URL', () => {
    expect(decodeBase64Urls(b64('hello world'))).toEqual([]);
    expect(decodeBase64Urls(b64('javascript:alert(1)'))).toEqual([]);
  });

  it('rejects invalid or empty input', () => {
    expect(decodeBase64Urls('')).toEqual([]);
    expect(decodeBase64Urls('not base64!!')).toEqual([]);
    expect(decodeBase64Urls('download')).toEqual([]);
    expect(decodeBase64Urls('A')).toEqual([]);
  });

  it('rejects oversized input', () => {
    expect(decodeBase64Urls('A'.repeat(20000))).toEqual([]);
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
    expect(extractUrlsWithBase64(wrap(e, 12))).toEqual({ urls: [URL1], decoded: true });
  });

  it('expands multi-link blobs and blobs with text on several lines', () => {
    const text = `${b64(`${URL1}\n${URL2}`)}\n${b64('Title\nhttp://example.net/z pw: 1')}`;
    expect(extractUrlsWithBase64(text)).toEqual({ urls: [URL1, URL2, 'http://example.net/z'], decoded: true });
  });

  it('decodes a wrapped multi-link blob', () => {
    const e = b64(`${URL1}\n${URL2}`);
    expect(extractUrlsWithBase64(wrap(e, 16))).toEqual({ urls: [URL1, URL2], decoded: true });
  });

  it('keeps equal-length separate blobs apart (e.g. part1/part2)', () => {
    const p1 = 'https://example.com/files/archive.part1.rar';
    const p2 = 'https://example.com/files/archive.part2.rar';
    expect(extractUrlsWithBase64(`${b64(p1)}\n${b64(p2)}`)).toEqual({ urls: [p1, p2], decoded: true });
  });

  it('returns nothing for ordinary text', () => {
    expect(extractUrlsWithBase64('just some words here')).toEqual({ urls: [], decoded: false });
  });
});
