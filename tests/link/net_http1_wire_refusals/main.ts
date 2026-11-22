// The HTTP/1 wire layer's refusals, each an answer and none a panic: the
// checked twins of `feed`, `http1WriteChunk`, `percentDecode`,
// `httpAcceptEncoding`, `httpContentEncoding`, `compress` and
// `compressAnyway`, which answer a code where the original panics on a window
// outside its buffer; the parser's 413 when its input cannot be taken and its
// 400 or 414 for a malformed or oversized line; and `urlDecode` and
// `urlQueryGet` on a multi-byte escape. Whether the twins can panic is
// `tests/std-panics.json`'s answer, not this program's.
import {
  HTTP1_BAD_WINDOW,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  Http1Parser,
  http1TryWriteChunk,
} from "nish/net/http1-codec";
import {
  HTTP_CODING_BAD_WINDOW,
  HTTP_CODING_GZIP,
  HTTP_COMPRESS_BAD_WINDOW,
  HTTP_COMPRESS_SENT,
  HTTP_OFFER_GZIP,
  HttpCompressor,
  httpTryAcceptEncoding,
  httpTryContentEncoding,
} from "nish/net/http-compress";
import { URL_DECODE_ERR_WINDOW, tryPercentDecode, urlDecode, urlQueryGet } from "nish/net/url";
import { Suite } from "nish/testing";

/** `text`'s bytes, one a character. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** A parser with the server's default limits. */
const parser = (): Http1Parser => new Http1Parser(8192, 16384, 100, 1048576);

/** What `next()` answers once `text` is fed whole. */
const eventOf = (p: Http1Parser, text: string): i32 => {
  const bytes: u8[] = bytesOf(text);
  if (!p.tryFeed(bytes, 0, toI32(bytes.length))) {
    return -1;
  }
  return p.next();
};

/** `count` copies of `c`. */
const repeated = (c: string, count: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < count; k++) {
    parts.push(c);
  }
  return parts.join("");
};

export const main = (): i32 => {
  const t = new Suite("net_http1_wire_refusals");

  // ---- Http1Parser.tryFeed --------------------------------------------------
  const data: u8[] = bytesOf("GET / HTTP/1.1\r\n");
  const p: Http1Parser = parser();
  t.eqBool("tryFeed: a window past the data answers false", p.tryFeed(data, 4, 100), false);
  t.eqBool("tryFeed: a negative offset answers false", p.tryFeed(data, -1, 2), false);
  t.eqBool("tryFeed: a negative length answers false", p.tryFeed(data, 0, -1), false);
  t.eqI32("and takes nothing", p.buffered(), 0);
  t.eqBool("tryFeed: the whole data answers true", p.tryFeed(data, 0, toI32(data.length)), true);
  t.eqI32("and is buffered", p.buffered(), toI32(data.length));

  // The window fields are public. A parser whose live input a caller moved
  // past 2^30 bytes cannot take more: a 413, not a panic.
  const big: Http1Parser = parser();
  big.start = -1073741824;
  t.eqBool("tryFeed: past 2^30 buffered still answers true", big.tryFeed(data, 0, 4), true);
  t.eqI32("and next() refuses", big.next(), HTTP1_ERROR);
  t.eqI32("with a 413", big.status, 413);
  // One whose end a caller moved past its buffer cannot copy the input in.
  const past: Http1Parser = parser();
  past.end = 5000;
  t.eqBool("tryFeed: an end past the buffer still answers true", past.tryFeed(data, 0, 4), true);
  t.eqI32("and next() refuses", past.next(), HTTP1_ERROR);
  t.eqI32("with a 413", past.status, 413);

  // ---- http1TakeLine through next() ----------------------------------------
  const ok: Http1Parser = parser();
  t.eqI32("a well-formed head is a head", eventOf(ok, "GET / HTTP/1.1\r\nHost: a\r\n\r\n"), HTTP1_HEAD);
  const lf: Http1Parser = parser();
  t.eqI32("a request line ended in a bare LF is refused", eventOf(lf, "GET / HTTP/1.1\nHost: a\r\n\r\n"), HTTP1_ERROR);
  t.eqI32("with a 400", lf.status, 400);
  const control: Http1Parser = parser();
  t.eqI32(
    "a field line holding a control byte is refused",
    eventOf(control, "GET / HTTP/1.1\r\nHost: a\u0001b\r\n\r\n"),
    HTTP1_ERROR,
  );
  t.eqI32("with a 400", control.status, 400);
  const longTarget: Http1Parser = new Http1Parser(64, 16384, 100, 1048576);
  t.eqI32(
    "a request line past its limit is refused before its CRLF arrives",
    eventOf(longTarget, "GET /" + repeated("a", 200)),
    HTTP1_ERROR,
  );
  t.eqI32("with a 414", longTarget.status, 414);
  const partial: Http1Parser = parser();
  t.eqI32("a line cut short waits for more", eventOf(partial, "GET / HTTP/1.1\r"), HTTP1_NEED_MORE);

  // ---- http1TryWriteChunk ---------------------------------------------------
  const out: u8[] = [];
  for (let k: i32 = 0; k < 64; k++) {
    out.push(0);
  }
  const body: u8[] = bytesOf("hello");
  t.eqI32("http1TryWriteChunk: a window past the data", http1TryWriteChunk(out, 0, body, 2, 10), HTTP1_BAD_WINDOW);
  t.eqI32("http1TryWriteChunk: a negative length", http1TryWriteChunk(out, 0, body, 0, -1), HTTP1_BAD_WINDOW);
  t.eqI32("http1TryWriteChunk: a good window writes `5\\r\\nhello\\r\\n`", http1TryWriteChunk(out, 0, body, 0, 5), 10);

  // ---- tryPercentDecode, urlDecode, urlQueryGet ----------------------------
  const escaped: u8[] = bytesOf("%C3%A9");
  const room: u8[] = [0, 0, 0, 0, 0, 0];
  t.eqI32("tryPercentDecode: a window past the source", tryPercentDecode(escaped, 2, 10, room, 0, 0), URL_DECODE_ERR_WINDOW);
  t.eqI32("tryPercentDecode: an output index past the output", tryPercentDecode(escaped, 0, 6, room, 7, 0), URL_DECODE_ERR_WINDOW);
  t.eqI32("tryPercentDecode: `%C3%A9` decodes to two bytes", tryPercentDecode(escaped, 0, 6, room, 0, 0), 2);
  t.eqI32("the first is 0xC3", toI32(room[0]), 195);
  t.eqI32("the second is 0xA9", toI32(room[1]), 169);
  const decoded: string | null = urlDecode("%C3%A9", 0);
  t.eqStr("urlDecode: `%C3%A9` is `é`, two UTF-8 bytes natively", decoded === null ? "(null)" : decoded, "é");
  const value: string | null = urlQueryGet("/s?q=caf%C3%A9", "q");
  t.eqStr("urlQueryGet: `q=caf%C3%A9` is `café`", value === null ? "(null)" : value, "café");
  t.eqBool("urlDecode: a lone `%C3` is not UTF-8, so null", urlDecode("%C3", 0) === null, true);

  // ---- httpTryAcceptEncoding, httpTryContentEncoding -----------------------
  const accept: u8[] = bytesOf("gzip");
  t.eqI32("httpTryAcceptEncoding: an end past the buffer", httpTryAcceptEncoding(accept, 0, 9, HTTP_OFFER_GZIP), HTTP_CODING_BAD_WINDOW);
  t.eqI32("httpTryAcceptEncoding: a start after its end", httpTryAcceptEncoding(accept, 3, 1, HTTP_OFFER_GZIP), HTTP_CODING_BAD_WINDOW);
  t.eqI32("httpTryAcceptEncoding: `gzip` is gzip", httpTryAcceptEncoding(accept, 0, 4, HTTP_OFFER_GZIP), HTTP_CODING_GZIP);
  t.eqI32("httpTryContentEncoding: an end past the buffer", httpTryContentEncoding(accept, 0, 9), HTTP_CODING_BAD_WINDOW);
  t.eqI32("httpTryContentEncoding: `gzip` is gzip", httpTryContentEncoding(accept, 0, 4), HTTP_CODING_GZIP);

  // ---- HttpCompressor.tryCompress, tryCompressAnyway ------------------------
  const c: HttpCompressor = new HttpCompressor(1, 0, 4096);
  const text: u8[] = bytesOf(repeated("nish ", 200));
  t.eqI32("tryCompress: a window past the body", c.tryCompress(HTTP_CODING_GZIP, text, 900, 200), -1);
  t.eqI32("says so", c.decision, HTTP_COMPRESS_BAD_WINDOW);
  t.eqI32("tryCompressAnyway: a negative offset", c.tryCompressAnyway(HTTP_CODING_GZIP, text, -1, 4), -1);
  t.eqI32("says so", c.decision, HTTP_COMPRESS_BAD_WINDOW);
  t.ok("tryCompress: the whole body compresses", c.tryCompress(HTTP_CODING_GZIP, text, 0, toI32(text.length)) > 0);
  t.eqI32("and is sent", c.decision, HTTP_COMPRESS_SENT);
  t.ok("tryCompressAnyway: so does a short one", c.tryCompressAnyway(HTTP_CODING_GZIP, text, 0, 5) > 0);
  t.eqI32("and is sent", c.decision, HTTP_COMPRESS_SENT);

  return t.done();
};
