// `nish/net/http1` against RFC 9112. Four groups of checks:
//
// - **The split corpus.** Each request stream below is fed whole, cut in two
//   at every byte, and fed one byte at a time, and the transcript — every head,
//   the body of each message, and how the stream ended — must be the same
//   every way. The whole transcript is also pinned, so "the same" is the right
//   answer and not merely a consistent one. The corpus holds pipelined
//   keep-alive requests, both body framings, an upgrade, and the
//   request-smuggling shapes, which must be refused at the same byte however
//   the stream was cut.
// - **The refusals**, one request per rule, each with the status RFC 9112 or
//   RFC 9110 names for it.
// - **Connection management**: keep-alive for 1.0 and 1.1, `Upgrade`, and the
//   parser's state after it closes, upgrades or refuses.
// - **The writer**: exact status lines and framing fields, its refusals, and
//   chunked bodies round-tripped through the parser.
import { Suite } from "nish/testing";
import {
  HTTP1_BODY,
  HTTP1_CHUNKED,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_MAX_METHOD,
  HTTP1_NEED_MORE,
  HTTP1_NO_BODY,
  HTTP1_UPGRADE,
  Http1Parser,
  HTTP1_NO_ROOM,
  HTTP1_REFUSED,
  http1BytesAre,
  http1Chunk,
  http1LastChunk,
  http1ResponseHead,
  http1WriteChunk,
  http1WriteLastChunk,
  http1WriteResponseHead,
} from "nish/net/http1";

/** The bytes of a string, which in the language is bytes already. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `buf[off .. off + len)` as a string. */
const textOf = (buf: u8[], off: i32, len: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = off; i >= 0 && i < off + len && i < toI32(buf.length); i += 1) {
    parts.push(String.fromCharCode(toI32(buf[i])));
  }
  return parts.join("");
};

/** What a stream did, as text: one line per head and per message, then how it ended. */
class Transcript {
  log: string[];
  body: string[];
  constructor() {
    this.log = [];
    this.body = [];
  }
}

/** A head as one line: everything the parser decided about the request. */
const describeHead = (p: Http1Parser): string => {
  const fields: string[] = [];
  const count: i32 = toI32(p.names.length);
  for (let i: i32 = 0; i < count; i += 1) {
    fields.push(`${p.names[i]}=${p.values[i]}`);
  }
  const keep: string = p.keepAlive ? "keep" : "close";
  const framing: string = p.chunked ? "chunked" : `length ${p.contentLength}`;
  return `${p.method} ${p.target} 1.${p.minor} ${keep} ${framing} up=${p.upgrade} [${fields.join("; ")}]`;
};

/**
 * The same line as `describeHead`, read from the spans of a parser that keeps
 * no text: what proves that `keepText = false` loses nothing.
 */
const describeSpans = (p: Http1Parser): string => {
  const fields: string[] = [];
  const upgrades: string[] = [];
  for (let i: i32 = 0; i < p.headerCount; i += 1) {
    const name: string = textOf(p.head, p.spans[4 * i], p.spans[4 * i + 1] - p.spans[4 * i]);
    const value: string = textOf(p.head, p.spans[4 * i + 2], p.spans[4 * i + 3] - p.spans[4 * i + 2]);
    fields.push(`${name}=${value}`);
    if (name === "upgrade") {
      upgrades.push(value);
    }
  }
  const keep: string = p.keepAlive ? "keep" : "close";
  const framing: string = p.chunked ? "chunked" : `length ${p.contentLength}`;
  const method: string = textOf(p.head, p.methodStart, p.methodEnd - p.methodStart);
  const target: string = textOf(p.head, p.targetStart, p.targetEnd - p.targetStart);
  const up: string = p.upgrading ? upgrades.join(", ") : "";
  return `${method} ${target} 1.${p.minor} ${keep} ${framing} up=${up} [${fields.join("; ")}]`;
};

/** Pulls events until the parser wants more input or has stopped. */
const drain = (p: Http1Parser, t: Transcript): void => {
  let e: i32 = p.next();
  while (e === HTTP1_HEAD || e === HTTP1_BODY || e === HTTP1_END) {
    if (e === HTTP1_HEAD) {
      t.log.push(p.keepText ? describeHead(p) : describeSpans(p));
    } else if (e === HTTP1_BODY) {
      t.body.push(textOf(p.body, p.bodyOff, p.bodyLen));
    } else {
      t.log.push(`body "${t.body.join("")}"`);
      t.body = [];
    }
    e = p.next();
  }
};

/** How the stream stands once all of it is in. */
const finish = (p: Http1Parser, t: Transcript): string => {
  const e: i32 = p.next();
  if (toI32(t.body.length) > 0) {
    t.log.push(`partial body "${t.body.join("")}"`);
  }
  if (e === HTTP1_NEED_MORE) {
    t.log.push("needs more");
  } else if (e === HTTP1_UPGRADE) {
    const rest: u8[] = p.upgradeBytes();
    t.log.push(`upgrade, then "${textOf(rest, 0, toI32(rest.length))}"`);
  } else if (e === HTTP1_CLOSED) {
    t.log.push("closed");
  } else if (e === HTTP1_ERROR) {
    t.log.push(`error ${p.status}`);
  } else {
    t.log.push(`unexpected event ${e}`);
  }
  return t.log.join("\n");
};

/**
 * The corpus's limits: a 64-byte target, 512 bytes and 16 fields of header, a
 * 1024-byte body; the head kept as text, or only as spans.
 */
const corpusParserWith = (text: boolean): Http1Parser => {
  const maxTarget: i32 = 64;
  const maxHeaderBytes: i32 = 512;
  const maxHeaders: i32 = 16;
  const maxBody: i32 = 1024;
  const p: Http1Parser = new Http1Parser(maxTarget, maxHeaderBytes, maxHeaders, maxBody);
  p.keepText = text;
  return p;
};

const corpusParser = (): Http1Parser => corpusParserWith(true);

/** The transcript of `data` fed as `data[0 .. cut)` and then the rest, by a parser that keeps the head as text or not. */
const transcriptSplitAt = (data: u8[], cut: i32, text: boolean): string => {
  const p: Http1Parser = corpusParserWith(text);
  const t: Transcript = new Transcript();
  const start: i32 = 0;
  p.feed(data, start, cut);
  drain(p, t);
  p.feed(data, cut, toI32(data.length) - cut);
  drain(p, t);
  return finish(p, t);
};

/** The transcript of `data` fed one byte at a time. */
const transcriptByteByByte = (data: u8[]): string => {
  const p: Http1Parser = corpusParser();
  const t: Transcript = new Transcript();
  const one: i32 = 1;
  const n: i32 = toI32(data.length);
  for (let i: i32 = 0; i < n; i += 1) {
    p.feed(data, i, one);
    drain(p, t);
  }
  return finish(p, t);
};

/**
 * The first cut of `text` whose transcript differs from the whole one, or -1
 * when there is none and feeding it a byte at a time agrees too (-2 if not).
 */
const firstBadCut = (text: string): i32 => {
  const data: u8[] = bytesOf(text);
  const n: i32 = toI32(data.length);
  const whole: string = transcriptSplitAt(data, n, true);
  for (let cut: i32 = 0; cut < n; cut += 1) {
    // Each pass builds two parsers and their transcripts, which nothing keeps.
    const mark: i64 = Arena.mark();
    const same: boolean =
      transcriptSplitAt(data, cut, true) === whole && transcriptSplitAt(data, cut, false) === whole;
    Arena.release(mark);
    if (!same) {
      return cut;
    }
  }
  return transcriptByteByByte(data) === whole ? -1 : -2;
};

/** Pins the whole transcript of `text`, and that every way of cutting it agrees. */
const corpusCase = (t: Suite, name: string, text: string, expected: string): void => {
  const none: i32 = -1;
  const data: u8[] = bytesOf(text);
  t.eqStr(`${name}: transcript`, transcriptSplitAt(data, toI32(data.length), true), expected);
  t.eqI32(`${name}: the same cut at every byte, kept as text or as spans, and fed a byte at a time`, firstBadCut(text), none);
};

/** The refusal tests' limits: a 32-byte target, 256 bytes and 8 fields of header, a 64-byte body. */
const smallParser = (): Http1Parser => {
  const maxTarget: i32 = 32;
  const maxHeaderBytes: i32 = 256;
  const maxHeaders: i32 = 8;
  const maxBody: i32 = 64;
  return new Http1Parser(maxTarget, maxHeaderBytes, maxHeaders, maxBody);
};

/** The status `text` is refused with by `smallParser`, or 0 when it is not refused. */
const statusOf = (text: string): i32 => {
  const p: Http1Parser = smallParser();
  const data: u8[] = bytesOf(text);
  const start: i32 = 0;
  p.feed(data, start, toI32(data.length));
  let e: i32 = p.next();
  while (e === HTTP1_HEAD || e === HTTP1_BODY || e === HTTP1_END) {
    e = p.next();
  }
  return e === HTTP1_ERROR ? p.status : 0;
};

/** Checks that `text` is refused with `status`. */
const refused = (t: Suite, name: string, text: string, status: i32): void => {
  t.eqI32(`refused with ${status}: ${name}`, statusOf(text), status);
};

/** A parser that has been fed `text` whole, and the first event it answers. */
class Fed {
  p: Http1Parser;
  event: i32 = 0;
  constructor(p: Http1Parser) {
    this.p = p;
  }
}

const fedWith = (text: string): Fed => {
  const fed: Fed = new Fed(corpusParser());
  const data: u8[] = bytesOf(text);
  const start: i32 = 0;
  fed.p.feed(data, start, toI32(data.length));
  fed.event = fed.p.next();
  return fed;
};

/** Every response byte, as text, or "null" for a refusal. */
const headText = (head: u8[] | null): string => (head === null ? "null" : textOf(head, 0, toI32(head.length)));

/**
 * `body` written as chunks of `size` bytes and the last chunk, sent as a
 * chunked POST, and read back: the de-chunked body, or a description of
 * whatever went wrong.
 */
const chunkedRoundTrip = (body: u8[], size: i32): string => {
  const wire: u8[] = bytesOf("POST /upload HTTP/1.1\r\nHost: example.com\r\nTransfer-Encoding: chunked\r\n\r\n");
  const n: i32 = toI32(body.length);
  let at: i32 = 0;
  while (at < n) {
    const take: i32 = n - at < size ? n - at : size;
    for (const b of http1Chunk(body, at, take)) {
      wire.push(b);
    }
    at += take;
  }
  for (const b of http1LastChunk()) {
    wire.push(b);
  }
  const maxTarget: i32 = 64;
  const maxHeaderBytes: i32 = 512;
  const maxHeaders: i32 = 16;
  const maxBody: i32 = 100000;
  const p: Http1Parser = new Http1Parser(maxTarget, maxHeaderBytes, maxHeaders, maxBody);
  const start: i32 = 0;
  p.feed(wire, start, toI32(wire.length));
  const got: u8[] = [];
  let e: i32 = p.next();
  while (e === HTTP1_HEAD || e === HTTP1_BODY) {
    if (e === HTTP1_BODY) {
      for (let k: i32 = 0; k < p.bodyLen; k += 1) {
        got.push(p.body[p.bodyOff + k]);
      }
    }
    e = p.next();
  }
  if (e !== HTTP1_END) {
    return `ended with event ${e}, status ${p.status}`;
  }
  if (toI32(got.length) !== n) {
    return `${toI32(got.length)} bytes back of ${n}`;
  }
  for (let k: i32 = 0; k < toI32(got.length) && k < toI32(body.length); k += 1) {
    if (got[k] !== body[k]) {
      return `byte ${k} differs`;
    }
  }
  return "same";
};

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_http1_f64` can run the same checks under `--number-mode f64`.
 */
export const http1Checks = (): i32 => {
  const t = new Suite("http1");

  // --- The split corpus ------------------------------------------------------
  corpusCase(
    t,
    "two pipelined GETs on a kept-alive connection",
    "GET /index.html HTTP/1.1\r\nHost: example.com\r\nAccept: */*\r\n\r\nGET /next?q=1 HTTP/1.1\r\nHost: example.com\r\n\r\n",
    "GET /index.html 1.1 keep length -1 up= [host=example.com; accept=*/*]\n" +
      'body ""\n' +
      "GET /next?q=1 1.1 keep length -1 up= [host=example.com]\n" +
      'body ""\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a POST with Content-Length, field names lowered and values trimmed",
    "POST /form HTTP/1.1\r\nHOST:example.com\r\nContent-Type: \t text/plain \t\r\nContent-Length: 11\r\n\r\nhello world",
    "POST /form 1.1 keep length 11 up= [host=example.com; content-type=text/plain; content-length=11]\n" +
      'body "hello world"\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a chunked POST with an extension and a trailer, then a GET",
    "POST /up HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n" +
      "5;name=value\r\nhello\r\n1A \t;x\r\n abcdefghijklmnopqrstuvwxy\r\n0\r\nExpires: never\r\n\r\n" +
      "GET / HTTP/1.1\r\nHost: a\r\n\r\n",
    "POST /up 1.1 keep chunked up= [host=a; transfer-encoding=chunked]\n" +
      'body "hello abcdefghijklmnopqrstuvwxy"\n' +
      "GET / 1.1 keep length -1 up= [host=a]\n" +
      'body ""\n' +
      "needs more"
  );
  corpusCase(
    t,
    "an HTTP/1.0 request closes, and what follows it is not read",
    "GET /old HTTP/1.0\r\n\r\nGET /ignored HTTP/1.0\r\n\r\n",
    'GET /old 1.0 close length -1 up= []\nbody ""\nclosed'
  );
  corpusCase(
    t,
    "HTTP/1.0 with keep-alive, an empty line before the next request, and Connection: close",
    "GET /a HTTP/1.0\r\nConnection: Keep-Alive\r\n\r\n\r\nGET /b HTTP/1.1\r\nHost: h\r\nConnection: close\r\nContent-Length: 2\r\n\r\nokGET /c HTTP/1.1\r\n",
    "GET /a 1.0 keep length -1 up= [connection=Keep-Alive]\n" +
      'body ""\n' +
      "GET /b 1.1 close length 2 up= [host=h; connection=close; content-length=2]\n" +
      'body "ok"\n' +
      "closed"
  );
  corpusCase(
    t,
    "a WebSocket upgrade, and the bytes after it",
    "GET /chat HTTP/1.1\r\nHost: server.example.com\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\nframes",
    "GET /chat 1.1 keep length -1 up=websocket [host=server.example.com; upgrade=websocket; connection=Upgrade; sec-websocket-key=dGhlIHNhbXBsZSBub25jZQ==; sec-websocket-version=13]\n" +
      'body ""\n' +
      'upgrade, then "frames"'
  );
  corpusCase(
    t,
    "a body that has not all arrived",
    "PUT /x HTTP/1.1\r\nHost: a\r\nContent-Length: 10\r\n\r\n12345",
    'PUT /x 1.1 keep length 10 up= [host=a; content-length=10]\npartial body "12345"\nneeds more'
  );
  corpusCase(
    t,
    "smuggling: Content-Length and Transfer-Encoding together",
    "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n",
    "error 400"
  );
  corpusCase(
    t,
    "smuggling: Content-Length twice, after a good request",
    "GET / HTTP/1.1\r\nHost: a\r\n\r\nPOST / HTTP/1.1\r\nHost: a\r\nContent-Length: 3\r\nContent-Length: 3\r\n\r\nabc",
    'GET / 1.1 keep length -1 up= [host=a]\nbody ""\nerror 400'
  );
  corpusCase(
    t,
    "smuggling: an obs-fold continuing Transfer-Encoding",
    "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: gzip\r\n , chunked\r\n\r\n",
    "error 400"
  );
  corpusCase(t, "smuggling: a bare LF ending a field line", "GET / HTTP/1.1\r\nHost: a\nX: y\r\n\r\n", "error 400");
  corpusCase(
    t,
    "smuggling: a chunk size written as 0x5",
    "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n0x5\r\nhello\r\n0\r\n\r\n",
    "POST / 1.1 keep chunked up= [host=a; transfer-encoding=chunked]\nerror 400"
  );
  corpusCase(
    t,
    "smuggling: chunk data longer than its size",
    "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nhello\r\n0\r\n\r\n",
    'POST / 1.1 keep chunked up= [host=a; transfer-encoding=chunked]\npartial body "hel"\nerror 400'
  );

  // A header past the parser's first 1024-byte buffer, so the buffer grows,
  // and a run of pipelined requests, so the consumed bytes are moved down.
  const longValue: string[] = [];
  for (let i: i32 = 0; i < 300; i += 1) {
    longValue.push("v");
  }
  const big: string = longValue.join("");
  const bigRequest: string = `GET /big HTTP/1.1\r\nHost: a\r\nX-A: ${big}\r\nX-B: ${big}\r\nX-C: ${big}\r\nX-D: ${big}\r\n\r\n`;
  const bigData: u8[] = bytesOf(bigRequest);
  const bigLimits: Http1Parser = new Http1Parser(64, 4096, 16, 0);
  const zero: i32 = 0;
  bigLimits.feed(bigData, zero, toI32(bigData.length));
  t.eqI32("a 1.2 KB header section grows the buffer and is read whole", bigLimits.next(), HTTP1_HEAD);
  t.eqStr("its last field arrives intact", bigLimits.header("x-d") === null ? "" : "present", "present");
  const many: string[] = [];
  for (let i: i32 = 0; i < 40; i += 1) {
    many.push(`GET /${i} HTTP/1.1\r\nHost: a\r\n\r\n`);
  }
  const manyData: u8[] = bytesOf(many.join(""));
  const manyParser: Http1Parser = corpusParser();
  let heads: i32 = 0;
  let lastTarget: string = "";
  const seven: i32 = 7;
  for (let at: i32 = 0; at < toI32(manyData.length); at += seven) {
    const take: i32 = toI32(manyData.length) - at < seven ? toI32(manyData.length) - at : seven;
    manyParser.feed(manyData, at, take);
    let e: i32 = manyParser.next();
    while (e !== HTTP1_NEED_MORE) {
      if (e === HTTP1_HEAD) {
        heads += 1;
        lastTarget = manyParser.target;
      }
      e = manyParser.next();
    }
  }
  const forty: i32 = 40;
  t.eqI32("forty pipelined requests fed seven bytes at a time give forty heads", heads, forty);
  t.eqStr("and the last of them is /39", lastTarget, "/39");

  // --- The refusals ----------------------------------------------------------
  // 400, the request line (RFC 9112 §3).
  refused(t, "a bare LF after the request line", "GET / HTTP/1.1\nHost: a\r\n\r\n", 400);
  refused(t, "a CR inside the request line", "GET /\r HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "an empty method", " / HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "a method that is not a token", "GE(T / HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "two spaces after the method", "GET  / HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "no request target", "GET HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "a non-ASCII byte in the target", "GET /é HTTP/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "a lowercase version", "GET / http/1.1\r\nHost: a\r\n\r\n", 400);
  refused(t, "a three-digit version", "GET / HTTP/1.10\r\nHost: a\r\n\r\n", 400);
  refused(t, "a version without a dot", "GET / HTTP/11\r\nHost: a\r\n\r\n", 400);
  refused(t, "a space after the version", "GET / HTTP/1.1 \r\nHost: a\r\n\r\n", 400);
  const longMethod: string[] = [];
  for (let i: i32 = 0; i <= HTTP1_MAX_METHOD; i += 1) {
    longMethod.push("M");
  }
  const method33: string = longMethod.join("");
  refused(t, "a 33-byte method", `${method33} / HTTP/1.1\r\nHost: a\r\n\r\n`, 400);
  refused(t, "a 33-byte method whose line has not ended", method33, 400);
  t.eqI32("a 32-byte method is read", statusOf(`${method33.substring(1)} / HTTP/1.1\r\nHost: a\r\n\r\n`), zero);
  // 400, the field lines (RFC 9112 §5, RFC 9110 §5.5).
  refused(t, "a bare LF after a field line", "GET / HTTP/1.1\r\nHost: a\nX: b\r\n\r\n", 400);
  refused(t, "a bare LF ending the header section", "GET / HTTP/1.1\r\nHost: a\r\n\n", 400);
  refused(t, "an obs-fold", "GET / HTTP/1.1\r\nHost: a\r\nX: b\r\n\tc\r\n\r\n", 400);
  refused(t, "whitespace before the first field", "GET / HTTP/1.1\r\n Host: a\r\n\r\n", 400);
  refused(t, "whitespace between a field name and its colon", "GET / HTTP/1.1\r\nHost : a\r\n\r\n", 400);
  refused(t, "a field line with no colon", "GET / HTTP/1.1\r\nHost a\r\n\r\n", 400);
  refused(t, "an empty field name", "GET / HTTP/1.1\r\n: a\r\nHost: a\r\n\r\n", 400);
  refused(t, "a NUL in a field value", "GET / HTTP/1.1\r\nHost: a\x00b\r\n\r\n", 400);
  refused(t, "a bare CR in a field value", "GET / HTTP/1.1\r\nHost: a\rb\r\n\r\n", 400);
  refused(t, "a DEL in a field value", "GET / HTTP/1.1\r\nHost: a\x7fb\r\n\r\n", 400);
  // 400, the request as a whole (RFC 9112 §3.2, §6).
  refused(t, "HTTP/1.1 without Host", "GET / HTTP/1.1\r\n\r\n", 400);
  refused(t, "HTTP/1.1 with two Host fields", "GET / HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n", 400);
  refused(t, "HTTP/1.0 with two Host fields", "GET / HTTP/1.0\r\nHost: a\r\nHost: a\r\n\r\n", 400);
  refused(
    t,
    "Transfer-Encoding before Content-Length",
    "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n",
    400
  );
  refused(t, "Content-Length as a list", "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 3, 3\r\n\r\nabc", 400);
  refused(t, "a signed Content-Length", "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: +3\r\n\r\nabc", 400);
  refused(t, "a negative Content-Length", "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: -1\r\n\r\n", 400);
  refused(t, "an empty Content-Length", "POST / HTTP/1.1\r\nHost: a\r\nContent-Length:\r\n\r\n", 400);
  refused(t, "Transfer-Encoding in HTTP/1.0", "POST / HTTP/1.0\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", 400);
  refused(t, "chunked not last", "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked, gzip\r\n\r\n", 400);
  refused(
    t,
    "chunked twice, across two fields",
    "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n\r\n",
    400
  );
  refused(t, "an empty Transfer-Encoding", "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: ,\r\n\r\n", 400);
  // 400, chunked framing (RFC 9112 §7.1).
  const x256Parts: string[] = [];
  for (let i: i32 = 0; i < 256; i += 1) {
    x256Parts.push("e");
  }
  const x256: string = x256Parts.join("");
  const chunkedHead: string = "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n";
  refused(t, "a chunk size with a sign", `${chunkedHead}-1\r\n`, 400);
  refused(t, "a chunk size after a space", `${chunkedHead} 5\r\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "a chunk size with a trailing space and no extension", `${chunkedHead}5 \r\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "a chunk size with trailing whitespace and no extension, after a good chunk", `${chunkedHead}5\r\nhello\r\n1A \t\r\n`, 400);
  refused(t, "a chunk size of two numbers", `${chunkedHead}5 5\r\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "an empty chunk size", `${chunkedHead}\r\n`, 400);
  refused(t, "a chunk size that is not hex", `${chunkedHead}g\r\n`, 400);
  refused(t, "a chunk size ending in a bare LF", `${chunkedHead}5\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "a NUL in a chunk extension", `${chunkedHead}5;a\x00b\r\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "chunk data followed by LF alone", `${chunkedHead}5\r\nhello\n0\r\n\r\n`, 400);
  refused(t, "a chunk-size line longer than the header limit", `${chunkedHead}5;${x256}\r\nhello\r\n0\r\n\r\n`, 400);
  refused(t, "a malformed trailer", `${chunkedHead}0\r\nbad trailer\r\n\r\n`, 400);
  // 413: the body over `maxBody` (64 here).
  refused(t, "Content-Length one over the limit", "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 65\r\n\r\n", 413);
  refused(
    t,
    "a Content-Length of 30 digits",
    "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 999999999999999999999999999999\r\n\r\n",
    413
  );
  refused(t, "a chunk over the limit", `${chunkedHead}41\r\n`, 413);
  refused(t, "a chunk size of 20 hex digits", `${chunkedHead}fffffffffffffffffff1\r\n`, 413);
  const thirtyTwo: string[] = [];
  for (let i: i32 = 0; i < 32; i += 1) {
    thirtyTwo.push("x");
  }
  const x32: string = thirtyTwo.join("");
  refused(t, "chunks that pass the limit together", `${chunkedHead}20\r\n${x32}\r\n20\r\n${x32}\r\n1\r\n`, 413);
  const zeroBody: Http1Parser = new Http1Parser(64, 512, 16, 0);
  const oneByte: u8[] = bytesOf("POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\n\r\n");
  zeroBody.feed(oneByte, zero, toI32(oneByte.length));
  t.eqI32("a body limit of zero refuses Content-Length: 5", zeroBody.next(), HTTP1_ERROR);
  const tooLarge: i32 = 413;
  t.eqI32("with 413", zeroBody.status, tooLarge);
  t.eqI32("Content-Length at the limit is read", statusOf("POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 64\r\n\r\n"), zero);
  t.eqI32("chunks up to the limit are read", statusOf(`${chunkedHead}20\r\n${x32}\r\n20\r\n${x32}\r\n0\r\n\r\n`), zero);
  // 414: the target over `maxTarget` (32 here).
  refused(t, "a 33-byte target", `GET /${x32} HTTP/1.1\r\nHost: a\r\n\r\n`, 414);
  refused(t, "a long target whose line has not ended", `GET /${x32}${x32}${x32}`, 414);
  t.eqI32("a 32-byte target is read", statusOf(`GET ${x32} HTTP/1.1\r\nHost: a\r\n\r\n`), zero);
  // 431: the header section over `maxHeaderBytes` (256) or `maxHeaders` (8).
  refused(
    t,
    "nine fields",
    "GET / HTTP/1.1\r\nHost: a\r\nA: 1\r\nB: 2\r\nC: 3\r\nD: 4\r\nE: 5\r\nF: 6\r\nG: 7\r\nH: 8\r\n\r\n",
    431
  );
  refused(t, "a header section over 256 bytes", `GET / HTTP/1.1\r\nHost: a\r\nX: ${x32}${x32}${x32}${x32}${x32}${x32}${x32}${x32}\r\n\r\n`, 431);
  refused(t, "a field line over the limit that has not ended", `GET / HTTP/1.1\r\nX: ${x32}${x32}${x32}${x32}${x32}${x32}${x32}${x32}`, 431);
  refused(
    t,
    "trailers past the field count",
    `${chunkedHead}0\r\nA: 1\r\nB: 2\r\nC: 3\r\nD: 4\r\nE: 5\r\nF: 6\r\nG: 7\r\n\r\n`,
    431
  );
  // 501 and 505.
  refused(t, "a transfer coding other than chunked", "POST / HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: gzip, chunked\r\n\r\n", 501);
  refused(t, "HTTP/2.0", "GET / HTTP/2.0\r\nHost: a\r\n\r\n", 505);
  refused(t, "HTTP/0.9", "GET / HTTP/0.9\r\n\r\n", 505);

  // --- Connection management ------------------------------------------------
  const v12: Fed = fedWith("GET / HTTP/1.2\r\nHost: a\r\n\r\n");
  const one: i32 = 1;
  t.eqI32("HTTP/1.2 is read as 1.1 (RFC 9110 §6.2)", v12.p.minor, one);
  t.eqBool("HTTP/1.1 keeps the connection by default", fedWith("GET / HTTP/1.1\r\nHost: a\r\n\r\n").p.keepAlive, true);
  t.eqBool(
    "HTTP/1.1 closes when Connection lists close, among other options and in any case",
    fedWith("GET / HTTP/1.1\r\nHost: a\r\nConnection: Keep-Alive, CLOSE\r\n\r\n").p.keepAlive,
    false
  );
  t.eqBool("HTTP/1.0 closes by default", fedWith("GET / HTTP/1.0\r\n\r\n").p.keepAlive, false);
  t.eqBool(
    "HTTP/1.0 keeps the connection for keep-alive",
    fedWith("GET / HTTP/1.0\r\nConnection: keep-alive\r\n\r\n").p.keepAlive,
    true
  );
  t.eqBool(
    "HTTP/1.0 closes for keep-alive and close together",
    fedWith("GET / HTTP/1.0\r\nConnection: keep-alive\r\nConnection: close\r\n\r\n").p.keepAlive,
    false
  );
  t.eqStr(
    "an Upgrade without Connection: upgrade is not an upgrade",
    fedWith("GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\n\r\n").p.upgrade,
    ""
  );
  t.eqStr(
    "an Upgrade in HTTP/1.0 is ignored (RFC 9110 §7.8)",
    fedWith("GET / HTTP/1.0\r\nUpgrade: websocket\r\nConnection: upgrade\r\n\r\n").p.upgrade,
    ""
  );
  t.eqStr(
    "two Upgrade fields are one list",
    fedWith("GET / HTTP/1.1\r\nHost: a\r\nUpgrade: h2c\r\nUpgrade: websocket\r\nConnection: upgrade\r\n\r\n").p.upgrade,
    "h2c, websocket"
  );

  const lookup: Fed = fedWith("GET / HTTP/1.1\r\nHost: a\r\nX-Twice: one\r\nx-twice: two\r\n\r\n");
  t.eqI32("a head is the first event", lookup.event, HTTP1_HEAD);
  t.eqStr("header() is case-insensitive and answers the first", lookup.p.header("X-TWICE") === null ? "" : "one", "one");
  t.eqBool("header() answers null for a field that is not there", lookup.p.header("x-absent") === null, true);
  t.eqStr("the second field of a name is in values", lookup.p.values[2], "two");

  // Upgrade, then decline it: the bytes that follow are HTTP again.
  const up: Fed = fedWith(
    "GET /chat HTTP/1.1\r\nHost: a\r\nConnection: upgrade\r\nUpgrade: websocket\r\n\r\nGET /after HTTP/1.1\r\nHost: a\r\n\r\n"
  );
  t.eqI32("an upgrade request ends", up.p.next(), HTTP1_END);
  t.eqI32("and then the parser stops at the upgrade", up.p.next(), HTTP1_UPGRADE);
  t.eqI32("and stays stopped", up.p.next(), HTTP1_UPGRADE);
  const later: u8[] = bytesOf("more");
  up.p.feed(later, zero, toI32(later.length));
  const rest: u8[] = up.p.upgradeBytes();
  t.eqStr(
    "upgradeBytes() holds what followed the request, and what was fed after",
    textOf(rest, zero, toI32(rest.length)),
    "GET /after HTTP/1.1\r\nHost: a\r\n\r\nmore"
  );
  up.p.declineUpgrade();
  t.eqI32("declineUpgrade() reads the next request as HTTP", up.p.next(), HTTP1_HEAD);
  t.eqStr("which is the one after the upgrade", up.p.target, "/after");
  up.p.declineUpgrade();
  t.eqI32("declineUpgrade() anywhere else does nothing", up.p.next(), HTTP1_END);

  const closed: Fed = fedWith("GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
  t.eqI32("a closing request ends", closed.p.next(), HTTP1_END);
  const again: u8[] = bytesOf("GET / HTTP/1.1\r\nHost: a\r\n\r\n");
  closed.p.feed(again, zero, toI32(again.length));
  t.eqI32("and input after the close is dropped", closed.p.next(), HTTP1_CLOSED);
  t.eqI32("an empty upgradeBytes() when nothing upgraded", toI32(closed.p.upgradeBytes().length), zero);

  const broken: Fed = fedWith("GET / HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n");
  t.eqI32("a refused request answers HTTP1_ERROR", broken.event, HTTP1_ERROR);
  t.eqStr("with its reason", broken.p.reason, "a request without exactly one Host");
  t.eqBool("and does not keep the connection", broken.p.keepAlive, false);
  broken.p.feed(again, zero, toI32(again.length));
  t.eqI32("and stays refused whatever follows", broken.p.next(), HTTP1_ERROR);

  const window: Fed = fedWith("POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 3\r\n\r\nabcGET");
  t.eqI32("a body event", window.p.next(), HTTP1_BODY);
  t.eqStr("is a window onto the parser's buffer", textOf(window.p.body, window.p.bodyOff, window.p.bodyLen), "abc");

  // Limits are clamped: the largest `i32` cannot overflow the parser's sums,
  // and a negative limit is zero.
  const widest: Http1Parser = new Http1Parser(2147483647, 2147483647, 2147483647, 2147483647);
  const simple: u8[] = bytesOf("GET /wide HTTP/1.1\r\nHost: a\r\nContent-Length: 2\r\n\r\nok");
  widest.feed(simple, zero, toI32(simple.length));
  t.eqI32("limits of 2^31 - 1 read a request", widest.next(), HTTP1_HEAD);
  const negative: Http1Parser = new Http1Parser(-1, 512, 16, -5);
  negative.feed(simple, zero, toI32(simple.length));
  t.eqI32("a negative target limit refuses any target", negative.next(), HTTP1_ERROR);
  const uriTooLong: i32 = 414;
  t.eqI32("with 414", negative.status, uriTooLong);

  // --- The writer -------------------------------------------------------------
  const ok: i32 = 200;
  const five: i32 = 5;
  t.eqStr(
    "a response with Content-Length",
    headText(http1ResponseHead(ok, "OK", ["Content-Type", "Connection"], ["text/plain", "keep-alive"], five)),
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: keep-alive\r\nContent-Length: 5\r\n\r\n"
  );
  t.eqStr(
    "a chunked response",
    headText(http1ResponseHead(ok, "OK", [], [], HTTP1_CHUNKED)),
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n"
  );
  t.eqStr(
    "an empty body is Content-Length: 0",
    headText(http1ResponseHead(ok, "OK", [], [], zero)),
    "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"
  );
  const switching: i32 = 101;
  t.eqStr(
    "101 with no body field",
    headText(http1ResponseHead(switching, "Switching Protocols", ["Upgrade"], ["websocket"], HTTP1_NO_BODY)),
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n\r\n"
  );
  const noContent: i32 = 204;
  const notModified: i32 = 304;
  t.eqStr("204 with no body field", headText(http1ResponseHead(noContent, "No Content", [], [], HTTP1_NO_BODY)), "HTTP/1.1 204 No Content\r\n\r\n");
  t.eqStr(
    "304 may carry a Content-Length",
    headText(http1ResponseHead(notModified, "Not Modified", [], [], five)),
    "HTTP/1.1 304 Not Modified\r\nContent-Length: 5\r\n\r\n"
  );
  t.eqStr("an empty reason phrase", headText(http1ResponseHead(ok, "", [], [], zero)), "HTTP/1.1 200 \r\nContent-Length: 0\r\n\r\n");
  const s99: i32 = 99;
  const s600: i32 = 600;
  const below: i32 = -3;
  t.eqStr("refused: status 99", headText(http1ResponseHead(s99, "X", [], [], zero)), "null");
  t.eqStr("refused: status 600", headText(http1ResponseHead(s600, "X", [], [], zero)), "null");
  t.eqStr("refused: a CR LF in the reason", headText(http1ResponseHead(ok, "OK\r\nX: y", [], [], zero)), "null");
  t.eqStr("refused: a LF in a value", headText(http1ResponseHead(ok, "OK", ["A"], ["b\nSet-Cookie: x"], zero)), "null");
  t.eqStr("refused: a space in a name", headText(http1ResponseHead(ok, "OK", ["A B"], ["c"], zero)), "null");
  t.eqStr("refused: an empty name", headText(http1ResponseHead(ok, "OK", [""], ["c"], zero)), "null");
  t.eqStr("refused: names and values of different lengths", headText(http1ResponseHead(ok, "OK", ["A", "B"], ["c"], zero)), "null");
  t.eqStr("refused: the caller's Content-Length", headText(http1ResponseHead(ok, "OK", ["content-LENGTH"], ["5"], five)), "null");
  t.eqStr(
    "refused: the caller's Transfer-Encoding",
    headText(http1ResponseHead(ok, "OK", ["Transfer-Encoding"], ["chunked"], HTTP1_NO_BODY)),
    "null"
  );
  t.eqStr("refused: 204 with a length", headText(http1ResponseHead(noContent, "No Content", [], [], zero)), "null");
  t.eqStr("refused: 101 chunked", headText(http1ResponseHead(switching, "Switching", [], [], HTTP1_CHUNKED)), "null");
  t.eqStr("refused: a body length of -3", headText(http1ResponseHead(ok, "OK", [], [], below)), "null");

  const digits: u8[] = bytesOf("0123456789abcdefghij");
  const ten: i32 = 10;
  const seventeen: i32 = 17;
  t.eqStr("a chunk of ten bytes", headText(http1Chunk(digits, zero, ten)), "a\r\n0123456789\r\n");
  t.eqStr("a chunk of seventeen bytes from an offset", headText(http1Chunk(digits, one, seventeen)), "11\r\n123456789abcdefgh\r\n");
  t.eqI32("an empty chunk writes nothing", toI32(http1Chunk(digits, five, zero).length), zero);
  t.eqStr("the last chunk", headText(http1LastChunk()), "0\r\n\r\n");

  const body: u8[] = new Array<u8>(5000);
  for (let i: i32 = 0; i < 5000; i += 1) {
    body[i] = toU8((i * 31 + 7) % 256);
  }
  const sizes: i32[] = [1, 15, 16, 17, 255, 256, 4096, 5000];
  for (const size of sizes) {
    t.eqStr(`5000 bytes round-trip in ${size}-byte chunks`, chunkedRoundTrip(body, size), "same");
  }
  const nothing: u8[] = [];
  t.eqStr("an empty chunked body round-trips", chunkedRoundTrip(nothing, ten), "same");

  // --- The spans, and the writers into a caller's buffer ---------------------------
  const spans: Http1Parser = corpusParserWith(false);
  const asked: u8[] = bytesOf(
    "GET /chat HTTP/1.1\r\nHost: a\r\nConnection: Upgrade\r\nUPGRADE: WebSocket\r\nSec-WebSocket-Version: 13\r\n\r\nleft"
  );
  spans.feed(asked, zero, toI32(asked.length));
  t.eqI32("a parser that keeps no text reads the head", spans.next(), HTTP1_HEAD);
  t.ok("methodIs and targetIs compare exactly", spans.methodIs("GET") && !spans.methodIs("get") && spans.targetIs("/chat") && !spans.targetIs("/cha"));
  t.ok("and the text fields stay empty", spans.method === "" && spans.target === "" && toI32(spans.names.length) === 0);
  const three: i32 = 3;
  t.eqI32("headerIndex is case-insensitive", spans.headerIndex("Sec-WebSocket-VERSION"), three);
  t.eqI32("headerIndex answers -1 for a field that is not there", spans.headerIndex("cookie"), toI32(-1));
  t.ok("headerIs compares the value exactly", spans.headerIs("sec-websocket-version", "13") && !spans.headerIs("sec-websocket-version", "1") && !spans.headerIs("x-absent", ""));
  t.eqStr("header() still answers a string, from the spans", spans.header("upgrade") === null ? "null" : "WebSocket", "WebSocket");
  t.ok("upgradeIs folds case", spans.upgradeIs("websocket") && !spans.upgradeIs("h2c"));
  t.eqI32("the upgrade request ends", spans.next(), HTTP1_END);
  t.eqI32("and buffered() counts what follows it", spans.buffered(), toI32(4));
  const twoUpgrades: Http1Parser = corpusParserWith(false);
  const listed: u8[] = bytesOf("GET / HTTP/1.1\r\nHost: a\r\nConnection: upgrade\r\nUpgrade: websocket\r\nUpgrade: h2c\r\n\r\n");
  twoUpgrades.feed(listed, zero, toI32(listed.length));
  twoUpgrades.next();
  t.ok("upgradeIs needs the one protocol alone", twoUpgrades.upgrading && !twoUpgrades.upgradeIs("websocket"));
  const plain: Http1Parser = corpusParserWith(false);
  const get: u8[] = bytesOf("GET / HTTP/1.1\r\nHost: a\r\n\r\n");
  plain.feed(get, zero, toI32(get.length));
  plain.next();
  t.ok("upgradeIs is false without an upgrade", !plain.upgradeIs("websocket") && !plain.upgrading);

  const capped: Http1Parser = corpusParserWith(false);
  capped.maxChunk = 4;
  const posted: u8[] = bytesOf("POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 10\r\n\r\n0123456789");
  capped.feed(posted, zero, toI32(posted.length));
  capped.next();
  const pieces: string[] = [];
  let piece: i32 = capped.next();
  while (piece === HTTP1_BODY) {
    pieces.push(textOf(capped.body, capped.bodyOff, capped.bodyLen));
    piece = capped.next();
  }
  t.eqStr("maxChunk caps each body event", pieces.join("|"), "0123|4567|89");
  capped.restart();
  t.eqI32("restart() forgets the last request", capped.buffered(), zero);
  capped.feed(get, zero, toI32(get.length));
  t.ok("and reads the next connection's first request", capped.next() === HTTP1_HEAD && capped.targetIs("/"));
  const refusing: Fed = fedWith("GET / HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n");
  refusing.p.restart();
  refusing.p.feed(get, zero, toI32(get.length));
  t.eqI32("restart() clears a refusal too", refusing.p.next(), HTTP1_HEAD);

  const out: u8[] = new Array<u8>(200);
  const names: u8[][] = [bytesOf("Content-Type")];
  const values: u8[][] = [bytesOf("text/plain")];
  const at: i32 = 7;
  const headEnd: i32 = http1WriteResponseHead(out, at, ok, "OK", names, values, five, "close");
  t.eqStr(
    "http1WriteResponseHead writes the head at its offset, with the Connection field last",
    headEnd < 0 ? "refused" : textOf(out, at, headEnd - at),
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\nConnection: close\r\n\r\n"
  );
  const none: u8[][] = [];
  const chunkedEnd: i32 = http1WriteResponseHead(out, zero, ok, "OK", none, none, HTTP1_CHUNKED, "");
  t.eqStr("and a chunked head with no Connection field", textOf(out, zero, chunkedEnd), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n");
  const exact: u8[] = new Array<u8>(headEnd - at);
  t.eqI32("a buffer exactly the head's size holds it", http1WriteResponseHead(exact, zero, ok, "OK", names, values, five, "close"), headEnd - at);
  const short: u8[] = new Array<u8>(headEnd - at - 1);
  short.fill(toU8(120));
  t.ok(
    "one byte short is HTTP1_NO_ROOM, and nothing is written",
    http1WriteResponseHead(short, zero, ok, "OK", names, values, five, "close") === HTTP1_NO_ROOM && short[0] === toU8(120)
  );
  t.eqI32("an offset past the buffer is HTTP1_NO_ROOM", http1WriteResponseHead(out, toI32(201), ok, "OK", none, none, zero, ""), HTTP1_NO_ROOM);
  t.eqI32("refused: a Connection field beside the server's", http1WriteResponseHead(out, zero, ok, "OK", [bytesOf("connection")], [bytesOf("x")], zero, "close"), HTTP1_REFUSED);
  t.eqI32("refused: a CR in the connection value", http1WriteResponseHead(out, zero, ok, "OK", none, none, zero, "close\r\nX: y"), HTTP1_REFUSED);
  t.eqI32("refused: a LF in a value's octets", http1WriteResponseHead(out, zero, ok, "OK", [bytesOf("a")], [bytesOf("b\nc")], zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: a name that is not a token", http1WriteResponseHead(out, zero, ok, "OK", [bytesOf("a b")], [bytesOf("c")], zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: the caller's Transfer-Encoding", http1WriteResponseHead(out, zero, ok, "OK", [bytesOf("Transfer-Encoding")], [bytesOf("gzip")], zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: names and values of different lengths", http1WriteResponseHead(out, zero, ok, "OK", names, none, zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: status 600", http1WriteResponseHead(out, zero, s600, "OK", none, none, zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: 204 with a length", http1WriteResponseHead(out, zero, noContent, "No Content", none, none, zero, ""), HTTP1_REFUSED);
  t.eqI32("refused: a reason with a LF", http1WriteResponseHead(out, zero, ok, "O\nK", none, none, zero, ""), HTTP1_REFUSED);

  const chunkEnd: i32 = http1WriteChunk(out, toI32(3), digits, one, seventeen);
  t.eqStr("http1WriteChunk writes the chunk at its offset", textOf(out, toI32(3), chunkEnd - 3), "11\r\n123456789abcdefgh\r\n");
  t.eqI32("an empty chunk writes nothing", http1WriteChunk(out, five, digits, zero, zero), five);
  const tight: u8[] = new Array<u8>(15);
  t.eqI32("a chunk that just fits is written", http1WriteChunk(tight, zero, digits, zero, ten), toI32(15));
  t.eqI32("one byte further on it is HTTP1_NO_ROOM", http1WriteChunk(tight, one, digits, zero, ten), HTTP1_NO_ROOM);

  const lastEnd: i32 = http1WriteLastChunk(out, toI32(3));
  t.eqStr("http1WriteLastChunk writes the last chunk at its offset", textOf(out, toI32(3), lastEnd - 3), "0\r\n\r\n");
  t.eqI32("and is HTTP1_NO_ROOM four bytes from the end", http1WriteLastChunk(tight, toI32(11)), HTTP1_NO_ROOM);
  t.ok(
    "http1BytesAre compares octets with a lowercase word in any case, and nothing longer or shorter",
    http1BytesAre(bytesOf("Content-LENGTH"), "content-length") && !http1BytesAre(bytesOf("content-lengthx"), "content-length") && !http1BytesAre(bytesOf("content"), "content-length")
  );

  return t.done();
};
