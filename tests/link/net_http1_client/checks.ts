// `nish/net/http1-client` against RFC 9112. Four groups of checks:
//
// - **The split corpus.** Each response stream below is fed whole, cut in two
//   at every byte, and fed one byte at a time, and the transcript — every
//   head, the body of each response, and how the stream ended — must be the
//   same every way. The whole transcript is also pinned. The corpus holds
//   kept-alive responses, every way a body is framed, interim responses, a
//   tunnel, a 101 to a request that asked for it, and the response-smuggling
//   shapes, which must be refused with the
//   same code however the stream was cut.
// - **The refusals**, one response per rule, each with its `HTTP1_E_` code.
// - **The limits**, each at exactly its cap and at one past it.
// - **The writer**: exact request heads, every target form, its refusals and
//   its room checks.
import { Suite } from "nish/testing";
import {
  HTTP1_BODY,
  HTTP1_CHUNKED,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_FIRST_INPUT,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_NO_BODY,
  HTTP1_NO_ROOM,
  HTTP1_REFUSED,
  HTTP1_UPGRADE,
  Http1Parser,
} from "nish/net/http1";
import {
  HTTP1_E_BARE_LF,
  HTTP1_E_BODY_LIMIT,
  HTTP1_E_CHUNK,
  HTTP1_E_CHUNK_LINE_LIMIT,
  HTTP1_E_CODING,
  HTTP1_E_COUNT_LIMIT,
  HTTP1_E_FIELD,
  HTTP1_E_FRAMING,
  HTTP1_E_HEADER_LIMIT,
  HTTP1_E_INFORMATIONAL_LIMIT,
  HTTP1_E_LENGTH,
  HTTP1_E_NONE,
  HTTP1_E_STATUS_LINE,
  HTTP1_E_STATUS_LINE_LIMIT,
  HTTP1_E_SWITCH,
  HTTP1_E_TRAILER_LIMIT,
  HTTP1_E_TRUNCATED,
  HTTP1_E_VERSION,
  HTTP1_INFORMATIONAL,
  HTTP1_MAX_CHUNK_LINE,
  HTTP1_MAX_INFORMATIONAL,
  Http1ResponseParser,
  http1RequestHead,
  http1UpgradeRequestHead,
  http1WriteRequestHead,
} from "nish/net/http1-client";

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

/** `text` repeated `n` times. */
const repeat = (text: string, n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push(text);
  }
  return parts.join("");
};

/** What a stream did, as text: one line per head and per response, then how it ended. */
class Transcript {
  log: string[];
  body: string[];
  constructor() {
    this.log = [];
    this.body = [];
  }
}

/** The fields of the response last read, as `name=value; ...`. */
const fieldsOf = (p: Http1ResponseParser): string => {
  const fields: string[] = [];
  for (let i: i32 = 0; i < toI32(p.names.length) && i < toI32(p.values.length); i += 1) {
    fields.push(`${p.names[i]}=${p.values[i]}`);
  }
  return fields.join("; ");
};

/** A final head as one line: everything the parser decided about the response. */
const describeHead = (p: Http1ResponseParser): string => {
  const keep: string = p.keepAlive() ? "keep" : "close";
  const framing: string = p.chunked ? "chunked" : `length ${p.contentLength}`;
  return `${p.status} 1.${p.minor} ${keep} ${framing} [${fieldsOf(p)}]`;
};

/**
 * Pulls events until the parser wants more input or has stopped, and says
 * the same `expect` for each response after the last one's end.
 */
const drain = (p: Http1ResponseParser, t: Transcript, a: Ask): void => {
  let e: i32 = p.next();
  while (e === HTTP1_INFORMATIONAL || e === HTTP1_HEAD || e === HTTP1_BODY || e === HTTP1_END) {
    if (e === HTTP1_INFORMATIONAL) {
      t.log.push(`1xx ${p.status} [${fieldsOf(p)}]`);
    } else if (e === HTTP1_HEAD) {
      t.log.push(describeHead(p));
    } else if (e === HTTP1_BODY) {
      t.body.push(textOf(p.body, p.bodyOff, p.bodyLen));
    } else {
      t.log.push(`body "${t.body.join("")}"`);
      t.body = [];
      expectAs(p, a);
    }
    e = p.next();
  }
};

/** How the stream stands once all of it is in. */
const ending = (p: Http1ResponseParser, t: Transcript): string => {
  const e: i32 = p.next();
  if (toI32(t.body.length) > 0) {
    t.log.push(`partial body "${t.body.join("")}"`);
  }
  if (e === HTTP1_NEED_MORE) {
    t.log.push("needs more");
  } else if (e === HTTP1_UPGRADE) {
    const rest: u8[] = p.tunnelBytes();
    t.log.push(`tunnel, then "${textOf(rest, 0, toI32(rest.length))}"`);
  } else if (e === HTTP1_CLOSED) {
    t.log.push("closed");
  } else if (e === HTTP1_ERROR) {
    t.log.push(`error ${p.error}`);
  } else {
    t.log.push(`unexpected event ${e}`);
  }
  return t.log.join("\n");
};

/**
 * How one corpus stream is read: what was asked, whether the request asked
 * to switch protocols, and whether the server closes after it.
 */
class Ask {
  head: boolean = false;
  connect: boolean = false;
  upgrade: boolean = false;
  close: boolean = false;
}

/** Says `a`'s `expect` to `p`, and `expectUpgrade` when `a` asked to switch protocols. */
const expectAs = (p: Http1ResponseParser, a: Ask): void => {
  p.expect(a.head, a.connect);
  if (a.upgrade) {
    p.expectUpgrade();
  }
};

const ask = (head: boolean, connect: boolean, close: boolean): Ask => {
  const a: Ask = new Ask();
  a.head = head;
  a.connect = connect;
  a.close = close;
  return a;
};

/**
 * The corpus's limits: a 64-byte status line, 512 bytes and 16 fields of
 * header, a 1024-byte body and a 128-byte trailer section.
 */
const corpusParser = (): Http1ResponseParser => {
  const maxStatusLine: i32 = 64;
  const maxHeaderBytes: i32 = 512;
  const maxHeaders: i32 = 16;
  const maxBody: i64 = 1024;
  const maxTrailerBytes: i32 = 128;
  return new Http1ResponseParser(maxStatusLine, maxHeaderBytes, maxHeaders, maxBody, maxTrailerBytes);
};

/** The transcript of `data` fed as `data[0 .. cut)` and then the rest. */
const transcriptSplitAt = (data: u8[], cut: i32, a: Ask): string => {
  const p: Http1ResponseParser = corpusParser();
  const t: Transcript = new Transcript();
  const start: i32 = 0;
  expectAs(p, a);
  p.feed(data, start, cut);
  drain(p, t, a);
  p.feed(data, cut, toI32(data.length) - cut);
  drain(p, t, a);
  if (a.close) {
    p.finish();
    drain(p, t, a);
  }
  return ending(p, t);
};

/** The transcript of `data` fed one byte at a time. */
const transcriptByteByByte = (data: u8[], a: Ask): string => {
  const p: Http1ResponseParser = corpusParser();
  const t: Transcript = new Transcript();
  const one: i32 = 1;
  const n: i32 = toI32(data.length);
  expectAs(p, a);
  for (let i: i32 = 0; i < n; i += 1) {
    p.feed(data, i, one);
    drain(p, t, a);
  }
  if (a.close) {
    p.finish();
    drain(p, t, a);
  }
  return ending(p, t);
};

/**
 * The first cut of `text` whose transcript differs from the whole one, or -1
 * when there is none and feeding it a byte at a time agrees too (-2 if not).
 */
const firstBadCut = (text: string, a: Ask): i32 => {
  const data: u8[] = bytesOf(text);
  const n: i32 = toI32(data.length);
  const whole: string = transcriptSplitAt(data, n, a);
  for (let cut: i32 = 0; cut < n; cut += 1) {
    if (transcriptSplitAt(data, cut, a) !== whole) {
      return cut;
    }
  }
  return transcriptByteByByte(data, a) === whole ? -1 : -2;
};

/** Pins the whole transcript of `text`, and that every way of cutting it agrees. */
const corpusCase = (t: Suite, name: string, text: string, a: Ask, expected: string): void => {
  const none: i32 = -1;
  const data: u8[] = bytesOf(text);
  t.eqStr(`${name}: transcript`, transcriptSplitAt(data, toI32(data.length), a), expected);
  t.eqI32(`${name}: the same cut at every byte and fed a byte at a time`, firstBadCut(text, a), none);
};

/** What feeding `text` whole to `p` came to: the responses ended and the error code. */
const outcomeOf = (p: Http1ResponseParser, text: string, a: Ask): string => {
  const data: u8[] = bytesOf(text);
  const start: i32 = 0;
  let ends: i32 = 0;
  expectAs(p, a);
  p.feed(data, start, toI32(data.length));
  if (a.close) {
    p.finish();
  }
  let e: i32 = p.next();
  while (e === HTTP1_INFORMATIONAL || e === HTTP1_HEAD || e === HTTP1_BODY || e === HTTP1_END) {
    if (e === HTTP1_END) {
      ends += 1;
      expectAs(p, a);
    }
    e = p.next();
  }
  return `ends ${ends}, error ${p.error}`;
};

/** The refusal tests' limits: a 32-byte status line, 256 bytes and 8 fields of header, a 64-byte body, 64 bytes of trailer. */
const smallParser = (): Http1ResponseParser => {
  const maxStatusLine: i32 = 32;
  const maxHeaderBytes: i32 = 256;
  const maxHeaders: i32 = 8;
  const maxBody: i64 = 64;
  const maxTrailerBytes: i32 = 64;
  return new Http1ResponseParser(maxStatusLine, maxHeaderBytes, maxHeaders, maxBody, maxTrailerBytes);
};


const plain = (): Ask => ask(false, false, false);
const closing = (): Ask => ask(false, false, true);
const toHead = (): Ask => ask(true, false, false);
const toConnect = (): Ask => ask(false, true, false);

/** A request that asked to switch protocols, as `http1UpgradeRequestHead` writes one. */
const toUpgrade = (): Ask => {
  const a: Ask = plain();
  a.upgrade = true;
  return a;
};

/**
 * Checks that `smallParser` refuses `text` with `code`. The check's name
 * carries the parser's `errorText`, so `expected.out` pins which rule refused.
 */
const refused = (t: Suite, name: string, text: string, a: Ask, code: i32): void => {
  const p: Http1ResponseParser = smallParser();
  outcomeOf(p, text, a);
  t.eqI32(`refused with ${code} (${p.errorText}): ${name}`, p.error, code);
};

/** Checks that `text` is read to its end with no refusal. */
const accepted = (t: Suite, name: string, text: string, a: Ask): void => {
  t.eqStr(`accepted: ${name}`, outcomeOf(smallParser(), text, a), "ends 1, error 0");
};

/** The transcript of `text` fed whole to `p`, then a close when `a` asks for one. */
const transcriptWith = (p: Http1ResponseParser, text: string, a: Ask): string => {
  const data: u8[] = bytesOf(text);
  const t: Transcript = new Transcript();
  const start: i32 = 0;
  expectAs(p, a);
  p.feed(data, start, toI32(data.length));
  drain(p, t, a);
  if (a.close) {
    p.finish();
    drain(p, t, a);
  }
  return ending(p, t);
};

/** A parser with the corpus's limits but for `which` (0 to 4, in the constructor's order) set to `value`. */
const limitedParser = (which: i32, value: i32): Http1ResponseParser => {
  const maxStatusLine: i32 = which === 0 ? value : 64;
  const maxHeaderBytes: i32 = which === 1 ? value : 512;
  const maxHeaders: i32 = which === 2 ? value : 16;
  const maxBody: i64 = which === 3 ? toI64(value) : toI64(8192);
  const maxTrailerBytes: i32 = which === 4 ? value : 128;
  return new Http1ResponseParser(maxStatusLine, maxHeaderBytes, maxHeaders, maxBody, maxTrailerBytes);
};

/** Pins the whole transcript of `text`, read with the corpus's limits. */
const readAs = (t: Suite, name: string, text: string, a: Ask, expected: string): void => {
  const data: u8[] = bytesOf(text);
  t.eqStr(`read: ${name}`, transcriptSplitAt(data, toI32(data.length), a), expected);
};

/**
 * The transcript of `data` fed in pieces of the sizes `pieces` names, in
 * turn and over again, to a parser with a 512-byte head and an 8192-byte
 * body: past `HTTP1_FIRST_INPUT`, so feeds after the first move the live
 * bytes down or into a larger buffer.
 */
const transcriptInPieces = (data: u8[], pieces: i32[], a: Ask): string => {
  const p: Http1ResponseParser = limitedParser(-1, 0);
  const t: Transcript = new Transcript();
  const n: i32 = toI32(data.length);
  let at: i32 = 0;
  let k: i32 = 0;
  expectAs(p, a);
  while (at < n) {
    let len: i32 = pieces[k % toI32(pieces.length)];
    if (len > n - at) {
      len = n - at;
    }
    p.feed(data, at, len);
    drain(p, t, a);
    at += len;
    k += 1;
  }
  return ending(p, t);
};

/** Pins the transcript of `text` fed in `pieces`, and that fed a byte at a time it is the same. */
const piecesCase = (t: Suite, name: string, text: string, pieces: i32[], expected: string): void => {
  const data: u8[] = bytesOf(text);
  const one: i32[] = [1];
  t.eqStr(`${name}: in pieces`, transcriptInPieces(data, pieces, plain()), expected);
  t.eqStr(`${name}: a byte at a time`, transcriptInPieces(data, one, plain()), expected);
};

/** Checks `text` against a limit of `cap`, which it meets exactly, and of `cap - 1`, which it passes by one. */
const atCap = (t: Suite, name: string, which: i32, cap: i32, text: string, a: Ask, code: i32): void => {
  t.eqStr(`${name}: exactly at the limit`, outcomeOf(limitedParser(which, cap), text, a), "ends 1, error 0");
  t.eqStr(`${name}: one past it`, outcomeOf(limitedParser(which, cap - 1), text, a), `ends 0, error ${code}`);
};

/** `p.header(name)`, or "null". */
const headerText = (p: Http1ResponseParser, name: string): string => {
  const v: string | null = p.header(name);
  return v === null ? "null" : v;
};

/** The transcript of `text` fed whole to `p`, with `a`'s expect said for the first response only. */
const firstAsked = (p: Http1ResponseParser, text: string, a: Ask): string => {
  const data: u8[] = bytesOf(text);
  const t: Transcript = new Transcript();
  const start: i32 = 0;
  expectAs(p, a);
  p.feed(data, start, toI32(data.length));
  // `drain` says expect after each end, which would hide what the parser
  // forgets on its own; this loop never says it again.
  let e: i32 = p.next();
  while (e === HTTP1_HEAD || e === HTTP1_BODY || e === HTTP1_END) {
    if (e === HTTP1_HEAD) {
      t.log.push(describeHead(p));
    } else if (e === HTTP1_BODY) {
      t.body.push(textOf(p.body, p.bodyOff, p.bodyLen));
    } else {
      t.log.push(`body "${t.body.join("")}"`);
      t.body = [];
    }
    e = p.next();
  }
  return ending(p, t);
};

/**
 * Checks that `text`, whose header sections each meet a limit of `cap`
 * exactly, ends `ends` responses under it, and none under `cap - 1`.
 */
const atCapEach = (t: Suite, name: string, which: i32, cap: i32, text: string, ends: i32, code: i32): void => {
  t.eqStr(`${name}: each exactly at the limit`, outcomeOf(limitedParser(which, cap), text, plain()), `ends ${ends}, error 0`);
  t.eqStr(`${name}: each one past it`, outcomeOf(limitedParser(which, cap - 1), text, plain()), `ends 0, error ${code}`);
};

/** What the parser holds once `text`, a kept-alive response and a malformed status line, is read. */
const afterSecondLine = (text: string): string => {
  const p: Http1ResponseParser = corpusParser();
  outcomeOf(p, text, plain());
  const keep: string = p.keepAlive() ? "keep" : "close";
  const framing: string = p.chunked ? "chunked" : `length ${p.contentLength}`;
  return `${p.status} 1.${p.minor} "${p.reason}" [${fieldsOf(p)}] ${framing} bodyLen ${p.bodyLen} ${keep}, error ${p.error}`;
};

/** Every request byte, as text, or "null" for a refusal. */
const headText = (head: u8[] | null): string => (head === null ? "null" : textOf(head, 0, toI32(head.length)));

/** `http1RequestHead` with one `Host: example.com` field and `extraName: extraValue` after it, when given. */
const requestWith = (method: string, target: string, extraName: string, extraValue: string, bodyLength: i64): string => {
  const names: string[] = ["Host"];
  const values: string[] = ["example.com"];
  if (toI32(extraName.length) > 0) {
    names.push(extraName);
    values.push(extraValue);
  }
  return headText(http1RequestHead(method, target, names, values, bodyLength));
};

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_http1_client_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const http1ClientChecks = (): i32 => {
  const t = new Suite("http1-client");

  // --- The split corpus ------------------------------------------------------
  corpusCase(
    t,
    "two kept-alive responses with Content-Length",
    "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Type: text/plain\r\n\r\nhelloHTTP/1.1 404 Not Found\r\ncontent-length:0\r\n\r\n",
    plain(),
    "200 1.1 keep length 5 [content-length=5; content-type=text/plain]\n" +
      'body "hello"\n' +
      "404 1.1 keep length 0 [content-length=0]\n" +
      'body ""\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a chunked response with an extension and a trailer, then a 204",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5;name=value\r\nhello\r\n6 ; x\r\n world\r\n0\r\nExpires: never\r\n\r\nHTTP/1.1 204 No Content\r\nContent-Length: 7\r\n\r\n",
    plain(),
    "200 1.1 keep chunked [transfer-encoding=chunked]\n" +
      'body "hello world"\n' +
      "204 1.1 keep length -1 [content-length=7]\n" +
      'body ""\n' +
      "needs more"
  );
  corpusCase(
    t,
    "two interim responses, each with its fields, then the final one",
    "HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 103 Early Hints\r\nLink: </style.css>; rel=preload\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok",
    plain(),
    "1xx 100 []\n" +
      "1xx 103 [link=</style.css>; rel=preload]\n" +
      "200 1.1 keep length 2 [content-length=2]\n" +
      'body "ok"\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a body read until the server closes",
    "HTTP/1.0 200 OK\r\nServer: old\r\n\r\nall of this is the body\r\n\r\nHTTP/1.1 200 OK\r\n",
    closing(),
    "200 1.0 close length -1 [server=old]\n" + 'body "all of this is the body\r\n\r\nHTTP/1.1 200 OK\r\n"\n' + "closed"
  );
  corpusCase(
    t,
    "an HTTP/1.0 response kept alive, then one that is not",
    "HTTP/1.0 200 OK\r\nConnection: Keep-Alive\r\nContent-Length: 3\r\n\r\nabcHTTP/1.0 200 OK\r\nContent-Length: 1\r\n\r\nzHTTP/1.0 200 OK\r\n\r\n",
    plain(),
    "200 1.0 keep length 3 [connection=Keep-Alive; content-length=3]\n" +
      'body "abc"\n' +
      "200 1.0 close length 1 [content-length=1]\n" +
      'body "z"\n' +
      "closed"
  );
  corpusCase(
    t,
    "Connection: close ends the connection, and what follows is not read",
    "HTTP/1.1 200 OK\r\nConnection: keep-alive, CLOSE\r\nContent-Length: 1\r\n\r\nxHTTP/1.1 999 not even a status\r\n\r\n",
    plain(),
    "200 1.1 close length 1 [connection=keep-alive, CLOSE; content-length=1]\n" + 'body "x"\n' + "closed"
  );
  corpusCase(
    t,
    "a response to HEAD and a 304 have no body, whatever their fields say",
    "HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\nHTTP/1.1 304 Not Modified\r\nTransfer-Encoding: chunked\r\n\r\n",
    toHead(),
    "200 1.1 keep length -1 [content-length=1000]\n" +
      'body ""\n' +
      "304 1.1 keep length -1 [transfer-encoding=chunked]\n" +
      'body ""\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a 304 to GET with a Content-Length has no body",
    "HTTP/1.1 304 Not Modified\r\nContent-Length: 5\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok",
    plain(),
    "304 1.1 keep length -1 [content-length=5]\n" +
      'body ""\n' +
      "200 1.1 keep length 2 [content-length=2]\n" +
      'body "ok"\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a 304 to GET that says chunked has no body",
    "HTTP/1.1 304 Not Modified\r\nTransfer-Encoding: chunked\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok",
    plain(),
    "304 1.1 keep length -1 [transfer-encoding=chunked]\n" +
      'body ""\n' +
      "200 1.1 keep length 2 [content-length=2]\n" +
      'body "ok"\n' +
      "needs more"
  );
  corpusCase(
    t,
    "a 2xx to CONNECT is a tunnel, and its framing fields are ignored",
    "HTTP/1.1 200 Connection Established\r\nContent-Length: 10\r\n\r\n\u0016\u0003\u0001 the tunnel's bytes",
    toConnect(),
    "200 1.1 close length -1 [content-length=10]\n" + 'body ""\n' + "tunnel, then \"\u0016\u0003\u0001 the tunnel's bytes\""
  );
  corpusCase(
    t,
    "a 407 to CONNECT has a body like any other",
    "HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 4\r\n\r\nnope",
    toConnect(),
    "407 1.1 keep length 4 [content-length=4]\n" + 'body "nope"\n' + "needs more"
  );
  corpusCase(
    t,
    "a body cut short by the close",
    "HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nhello",
    closing(),
    "200 1.1 keep length 10 [content-length=10]\n" + 'partial body "hello"\n' + "error 10"
  );
  corpusCase(
    t,
    "smuggling: Transfer-Encoding with Content-Length",
    "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nHTTP/1.1 200 OK\r\n\r\n",
    plain(),
    "error 6"
  );
  corpusCase(
    t,
    "smuggling: two Content-Length fields that differ",
    "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Length: 50\r\n\r\nhello",
    plain(),
    "error 8"
  );
  corpusCase(
    t,
    "smuggling: a coding after chunked",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked, identity\r\n\r\n0\r\n\r\n",
    plain(),
    "error 7"
  );
  corpusCase(
    t,
    "smuggling: a header line ended in a bare LF",
    "HTTP/1.1 200 OK\r\nX-A: 1\nContent-Length: 5\r\n\r\nhello",
    plain(),
    "error 3"
  );
  corpusCase(
    t,
    "smuggling: an obs-fold continuing Transfer-Encoding",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: identity\r\n chunked\r\n\r\n0\r\n\r\n",
    plain(),
    "error 4"
  );
  corpusCase(
    t,
    "smuggling: whitespace before the colon",
    "HTTP/1.1 200 OK\r\nContent-Length : 5\r\n\r\nhello",
    plain(),
    "error 4"
  );
  corpusCase(
    t,
    "smuggling: chunk data longer than its size",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nhello\r\n0\r\n\r\n",
    plain(),
    "200 1.1 keep chunked [transfer-encoding=chunked]\n" + 'partial body "hel"\n' + "error 9"
  );
  corpusCase(
    t,
    "a 101 this client never asked for",
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n\u0081\u0005hello",
    plain(),
    "error 5"
  );
  corpusCase(
    t,
    "a 101 to a request that asked to switch protocols, frame bytes glued to its head",
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n\u0081\u0005hello",
    toUpgrade(),
    "101 1.1 close length -1 [upgrade=websocket; connection=Upgrade]\n" + 'body ""\n' + 'tunnel, then "\u0081\u0005hello"'
  );
  corpusCase(
    t,
    "a 101 that asked to switch protocols ignores its framing fields",
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nContent-Length: 4\r\n\r\nabcd",
    toUpgrade(),
    "101 1.1 close length -1 [upgrade=websocket; content-length=4]\n" + 'body ""\n' + 'tunnel, then "abcd"'
  );
  corpusCase(
    t,
    "a request that asked to switch protocols, answered 200, reads as any other",
    "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok",
    toUpgrade(),
    "200 1.1 keep length 2 [content-length=2]\n" + 'body "ok"\n' + "needs more"
  );
  corpusCase(
    t,
    "a status line over the limit, ended in a bare LF past it",
    `HTTP/1.1 200 ${repeat("x", toI32(60))}\n`,
    plain(),
    "error 11"
  );

  // --- Past the first buffer -------------------------------------------------
  const longPieces: i32[] = [700, 333, 41];
  piecesCase(
    t,
    "a second head across the first 1 KiB",
    `HTTP/1.1 200 OK\r\nContent-Length: 960\r\n\r\n${repeat("a", toI32(960))}HTTP/1.1 200 OK\r\nX-Long: ${repeat("b", toI32(60))}\r\nContent-Length: 3\r\n\r\nxyz`,
    longPieces,
    `200 1.1 keep length 960 [content-length=960]\nbody "${repeat("a", toI32(960))}"\n` +
      `200 1.1 keep length 3 [x-long=${repeat("b", toI32(60))}; content-length=3]\nbody "xyz"\nneeds more`
  );
  const unevenPieces: i32[] = [13, 400, 1, 777, 250];
  piecesCase(
    t,
    "a 1500-byte body fed in uneven pieces",
    `HTTP/1.1 200 OK\r\nContent-Length: 1500\r\n\r\n${repeat("0123456789", toI32(150))}`,
    unevenPieces,
    `200 1.1 keep length 1500 [content-length=1500]\nbody "${repeat("0123456789", toI32(150))}"\nneeds more`
  );
  const pipelinedPieces: i32[] = [100, 900, 3];
  piecesCase(
    t,
    "two pipelined responses over 1 KiB together",
    `HTTP/1.1 200 OK\r\nContent-Length: 600\r\n\r\n${repeat("x", toI32(600))}HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1f4\r\n${repeat("y", toI32(500))}\r\n0\r\n\r\n`,
    pipelinedPieces,
    `200 1.1 keep length 600 [content-length=600]\nbody "${repeat("x", toI32(600))}"\n` +
      `200 1.1 keep chunked [transfer-encoding=chunked]\nbody "${repeat("y", toI32(500))}"\nneeds more`
  );
  const growPieces: i32[] = [300, 2000];
  piecesCase(
    t,
    "a head left part-read when a feed outgrows the buffer",
    `HTTP/1.1 200 OK\r\nX-Pad: ${repeat("p", toI32(300))}\r\nContent-Length: 3000\r\n\r\n${repeat("abc", toI32(1000))}`,
    growPieces,
    `200 1.1 keep length 3000 [x-pad=${repeat("p", toI32(300))}; content-length=3000]\nbody "${repeat("abc", toI32(1000))}"\nneeds more`
  );

  // --- The status line --------------------------------------------------------
  accepted(t, "a status code with no reason or space after it", "HTTP/1.1 204\r\n\r\n", plain());
  accepted(t, "an empty reason", "HTTP/1.1 204 \r\n\r\n", plain());
  readAs(t, "an HTTP/1.9 response, read as 1.1", "HTTP/1.9 204 No Content\r\n\r\n", plain(), '204 1.1 keep length -1 []\nbody ""\nneeds more');
  refused(t, "a two-digit status", "HTTP/1.1 20 OK\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a status above 599", "HTTP/1.1 600 Nope\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a status below 100", "HTTP/1.1 099 Nope\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "an empty line before the status line", "\r\nHTTP/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "two spaces after the version", "HTTP/1.1  204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a lowercase protocol name", "http/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a status code run into its reason", "HTTP/1.1 2040 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a control byte in the reason", "HTTP/1.1 204 No\u0001Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a non-digit minor version", "HTTP/1.x 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a status line one byte short of a status code", "HTTP/1.1 20\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "XTTP for HTTP", "XTTP/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "HXTP for HTTP", "HXTP/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "HTXP for HTTP", "HTXP/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "HTTX for HTTP", "HTTX/1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "no slash after HTTP", "HTTP-1.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a non-digit major version", "HTTP/x.1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "no dot in the version", "HTTP/1-1 204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "no space after the version", "HTTP/1.1X204 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a non-digit first status digit", "HTTP/1.1 X04 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a non-digit second status digit", "HTTP/1.1 2/4 No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "a non-digit third status digit", "HTTP/1.1 20/ No Content\r\n\r\n", plain(), HTTP1_E_STATUS_LINE);
  refused(t, "HTTP/2.0", "HTTP/2.0 204 No Content\r\n\r\n", plain(), HTTP1_E_VERSION);
  refused(t, "HTTP/0.9", "HTTP/0.9 204 No Content\r\n\r\n", plain(), HTTP1_E_VERSION);
  refused(t, "a status line ended in a bare LF", "HTTP/1.1 204 No Content\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "a 101", "HTTP/1.1 101 Switching Protocols\r\n\r\n", plain(), HTTP1_E_SWITCH);
  refused(t, "a 101 to CONNECT", "HTTP/1.1 101 Switching Protocols\r\n\r\n", toConnect(), HTTP1_E_SWITCH);
  refused(t, "a 101 to HEAD", "HTTP/1.1 101 Switching Protocols\r\n\r\n", toHead(), HTTP1_E_SWITCH);
  refused(t, "a 101 after a 100 to a request that asked for no switch", "HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 101 Switching Protocols\r\n\r\n", plain(), HTTP1_E_SWITCH);
  const origin: i32 = 0;
  const reset: Http1ResponseParser = smallParser();
  reset.expectUpgrade();
  outcomeOf(reset, "HTTP/1.1 101 Switching Protocols\r\n\r\n", plain());
  t.eqI32("refused: expect() after expectUpgrade() asks for no switch again", reset.error, HTTP1_E_SWITCH);
  const lateAsk: Http1ResponseParser = smallParser();
  lateAsk.expect(false, false);
  const interimFirst: u8[] = bytesOf("HTTP/1.1 100 Continue\r\n\r\n");
  lateAsk.feed(interimFirst, origin, toI32(interimFirst.length));
  t.eqI32("an interim response first", lateAsk.next(), HTTP1_INFORMATIONAL);
  lateAsk.expectUpgrade();
  const switchAfter: u8[] = bytesOf("HTTP/1.1 101 Switching Protocols\r\n\r\n");
  lateAsk.feed(switchAfter, origin, toI32(switchAfter.length));
  lateAsk.next();
  t.eqI32("refused: expectUpgrade() once a response has begun does nothing", lateAsk.error, HTTP1_E_SWITCH);
  const kept: Http1ResponseParser = smallParser();
  t.eqStr("asked to switch, a 200 ends", outcomeOf(kept, "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n", toUpgrade()), "ends 1, error 0");
  kept.expect(false, false);
  const nextSwitch: u8[] = bytesOf("HTTP/1.1 101 Switching Protocols\r\n\r\n");
  kept.feed(nextSwitch, origin, toI32(nextSwitch.length));
  kept.next();
  t.eqI32("refused: the next response on the connection is not asked to switch", kept.error, HTTP1_E_SWITCH);

  // --- Field lines -----------------------------------------------------------
  refused(t, "an empty field name", "HTTP/1.1 204 No Content\r\n: x\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a field line with no colon", "HTTP/1.1 204 No Content\r\nX-A\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a non-token byte in a name", "HTTP/1.1 204 No Content\r\nX(A): 1\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a NUL in a value", "HTTP/1.1 204 No Content\r\nX-A: a\u0000b\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a CR inside a value", "HTTP/1.1 204 No Content\r\nX-A: a\rb\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "an obs-fold in the first field", "HTTP/1.1 204 No Content\r\n\tX-A: 1\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a field line ended in a bare LF", "HTTP/1.1 204 No Content\r\nX-A: 1\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "the empty line ended in a bare LF", "HTTP/1.1 204 No Content\r\nX-A: 1\r\n\n", plain(), HTTP1_E_BARE_LF);

  // --- Framing ---------------------------------------------------------------
  readAs(t, "a Content-Length list of one value repeated", "HTTP/1.1 200 OK\r\nContent-Length: 2, 2\r\n\r\nok", plain(), '200 1.1 keep length 2 [content-length=2, 2]\nbody "ok"\nneeds more');
  readAs(t, "two Content-Length fields that agree", "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\nok", plain(), '200 1.1 keep length 2 [content-length=2; content-length=2]\nbody "ok"\nneeds more');
  readAs(t, "a Content-Length with leading zeros", "HTTP/1.1 200 OK\r\nContent-Length: 0002\r\n\r\nok", plain(), '200 1.1 keep length 2 [content-length=0002]\nbody "ok"\nneeds more');
  accepted(t, "chunked in any case", "HTTP/1.1 200 OK\r\nTransfer-Encoding: CHUNKED\r\n\r\n0\r\n\r\n", plain());
  refused(t, "a Content-Length that is not digits", "HTTP/1.1 200 OK\r\nContent-Length: 0x5\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "a negative Content-Length", "HTTP/1.1 200 OK\r\nContent-Length: -1\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "an empty Content-Length", "HTTP/1.1 200 OK\r\nContent-Length:\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "a Content-Length list with an empty element", "HTTP/1.1 200 OK\r\nContent-Length: 2,\r\n\r\nok", plain(), HTTP1_E_LENGTH);
  refused(t, "a Content-Length list whose values differ", "HTTP/1.1 200 OK\r\nContent-Length: 2, 3\r\n\r\nok", plain(), HTTP1_E_LENGTH);
  refused(t, "two Content-Length fields that differ", "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Length: 3\r\n\r\nok", plain(), HTTP1_E_LENGTH);
  refused(t, "a Content-Length with a sign", "HTTP/1.1 200 OK\r\nContent-Length: +2\r\n\r\nok", plain(), HTTP1_E_LENGTH);
  refused(t, "two Content-Length values past 2^53 that differ, on a 304", "HTTP/1.1 304 Not Modified\r\nContent-Length: 90071992547409930, 90071992547409931\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "a Content-Length past 2^53 repeated, which saturation cannot compare", "HTTP/1.1 304 Not Modified\r\nContent-Length: 90071992547409930\r\nContent-Length: 90071992547409930\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "a malformed Content-Length on a 304 too", "HTTP/1.1 304 Not Modified\r\nContent-Length: x\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "Content-Length values that differ, on a response to HEAD too", "HTTP/1.1 200 OK\r\nContent-Length: 1, 2\r\n\r\n", toHead(), HTTP1_E_LENGTH);
  refused(t, "Transfer-Encoding with Content-Length on a 204", "HTTP/1.1 204 No Content\r\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n\r\n", plain(), HTTP1_E_FRAMING);
  refused(t, "Content-Length before Transfer-Encoding", "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nTransfer-Encoding: chunked\r\n\r\n", plain(), HTTP1_E_FRAMING);
  refused(t, "Transfer-Encoding in an HTTP/1.0 response", "HTTP/1.0 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", plain(), HTTP1_E_CODING);
  refused(t, "a coding other than chunked", "HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\n\r\n", plain(), HTTP1_E_CODING);
  refused(t, "gzip before chunked", "HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip, chunked\r\n\r\n0\r\n\r\n", plain(), HTTP1_E_CODING);
  refused(t, "gzip before chunked, in two fields", "HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", plain(), HTTP1_E_CODING);
  refused(t, "chunked twice", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked, chunked\r\n\r\n0\r\n\r\n", plain(), HTTP1_E_CODING);
  refused(t, "an empty Transfer-Encoding", "HTTP/1.1 200 OK\r\nTransfer-Encoding: \r\n\r\n", plain(), HTTP1_E_CODING);
  readAs(t, "OWS around a Content-Length", "HTTP/1.1 200 OK\r\nContent-Length:\t5 \r\n\r\nhello", plain(), '200 1.1 keep length 5 [content-length=5]\nbody "hello"\nneeds more');
  readAs(t, "OWS inside a Content-Length list", "HTTP/1.1 200 OK\r\nContent-Length: 5 ,\t5\r\n\r\nhello", plain(), '200 1.1 keep length 5 [content-length=5 ,\t5]\nbody "hello"\nneeds more');
  readAs(t, "OWS after chunked", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked \t\r\n\r\n0\r\n\r\n", plain(), '200 1.1 keep chunked [transfer-encoding=chunked]\nbody ""\nneeds more');
  readAs(t, "OWS inside a transfer coding list", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked , \r\n\r\n0\r\n\r\n", plain(), '200 1.1 keep chunked [transfer-encoding=chunked ,]\nbody ""\nneeds more');
  readAs(t, "OWS after close", "HTTP/1.1 204 No Content\r\nConnection: close \r\n\r\n", plain(), '204 1.1 close length -1 [connection=close]\nbody ""\nclosed');
  readAs(t, "OWS inside a Connection list", "HTTP/1.1 204 No Content\r\nConnection: keep-alive , close\r\n\r\n", plain(), '204 1.1 close length -1 [connection=keep-alive , close]\nbody ""\nclosed');
  refused(t, "a bad coding on a response to HEAD too", "HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\n\r\n", toHead(), HTTP1_E_CODING);

  // --- Chunks ----------------------------------------------------------------
  readAs(
    t,
    "a chunk size in uppercase hex with leading zeros",
    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n00A\r\n0123456789\r\n0\r\n\r\n",
    plain(),
    '200 1.1 keep chunked [transfer-encoding=chunked]\nbody "0123456789"\nneeds more'
  );
  accepted(t, "a last chunk with an extension", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0;last\r\n\r\n", plain());
  refused(t, "a chunk size with no digits", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n;x\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "an empty chunk-size line", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "a 0x before the chunk size", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0x5\r\nhello\r\n0\r\n\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "whitespace after the chunk size with no extension", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5 \r\nhello\r\n0\r\n\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "a control byte in a chunk extension", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5;a\u0001\r\nhello\r\n0\r\n\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "chunk data followed by something else", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhelloXY0\r\n\r\n", plain(), HTTP1_E_CHUNK);
  refused(t, "chunk data followed by a bare LF", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\n0\r\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "a chunk-size line ended in a bare LF", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\nhello\r\n0\r\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "a malformed trailer", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n folded: x\r\n\r\n", plain(), HTTP1_E_FIELD);
  refused(t, "a trailer ended in a bare LF", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nX: y\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "a chunk size past 64 bits", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nffffffffffffffffffffffff\r\n", plain(), HTTP1_E_BODY_LIMIT);

  // --- How a connection ends -------------------------------------------------
  refused(t, "a close inside the status line", "HTTP/1.1 200", closing(), HTTP1_E_TRUNCATED);
  refused(t, "a close inside the header section", "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n", closing(), HTTP1_E_TRUNCATED);
  refused(t, "a close inside a chunk", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhel", closing(), HTTP1_E_TRUNCATED);
  refused(t, "a close before the last chunk", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n", closing(), HTTP1_E_TRUNCATED);
  refused(t, "a close inside the trailers", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nX: y\r\n", closing(), HTTP1_E_TRUNCATED);
  refused(t, "a close after an interim response", "HTTP/1.1 100 Continue\r\n\r\n", closing(), HTTP1_E_TRUNCATED);
  const whole: Http1ResponseParser = smallParser();
  t.eqStr("a close after a whole response is no error", outcomeOf(whole, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok", closing()), "ends 1, error 0");
  t.eqI32("and the parser answers HTTP1_CLOSED", whole.next(), HTTP1_CLOSED);

  const idle: Http1ResponseParser = smallParser();
  idle.finish();
  t.eqI32("a close with nothing fed is HTTP1_CLOSED", idle.next(), HTTP1_CLOSED);
  t.eqI32("and stays closed", idle.next(), HTTP1_CLOSED);
  const late: u8[] = bytesOf("HTTP/1.1 204 No Content\r\n\r\n");
  const zero: i32 = 0;
  idle.feed(late, zero, toI32(late.length));
  t.eqI32("bytes fed after the close are dropped", idle.buffered(), zero);
  t.eqI32("and the parser stays closed", idle.next(), HTTP1_CLOSED);

  const broken: Http1ResponseParser = smallParser();
  outcomeOf(broken, "HTTP/2.0 200 OK\r\n\r\n", plain());
  broken.feed(late, zero, toI32(late.length));
  t.eqI32("an error is final", broken.next(), HTTP1_ERROR);
  t.eqI32("and the bytes fed after it are dropped", broken.buffered(), zero);
  t.eqStr("errorText says why", broken.errorText, "an HTTP major version other than 1");
  t.ok("and keepAlive() is false", !broken.keepAlive());

  const closedByServer: Http1ResponseParser = smallParser();
  t.eqStr("a Connection: close response", outcomeOf(closedByServer, "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", plain()), "ends 1, error 0");
  t.eqI32("ends in HTTP1_CLOSED", closedByServer.next(), HTTP1_CLOSED);
  closedByServer.feed(late, zero, toI32(late.length));
  t.eqI32("and drops what is fed after it", closedByServer.buffered(), zero);

  // --- expect, the parser's state, and its fields ----------------------------
  const mid: Http1ResponseParser = smallParser();
  const partial: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n");
  mid.feed(partial, zero, toI32(partial.length));
  t.eqI32("a head", mid.next(), HTTP1_HEAD);
  mid.expect(true, false);
  const rest: u8[] = bytesOf("okHTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n");
  mid.feed(rest, zero, toI32(rest.length));
  t.eqI32("expect inside a response does nothing: its body still comes", mid.next(), HTTP1_BODY);
  t.eqI32("and ends", mid.next(), HTTP1_END);
  t.eqI32("expect is forgotten after HTTP1_END: the next 200 has a body again", mid.next(), HTTP1_HEAD);
  t.eqI32("a body the parser waits for", mid.next(), HTTP1_NEED_MORE);

  const interim: Http1ResponseParser = smallParser();
  interim.expect(true, false);
  const hinted: u8[] = bytesOf("HTTP/1.1 103 Early Hints\r\nLink: </a>\r\n\r\n");
  interim.feed(hinted, zero, toI32(hinted.length));
  t.eqI32("an interim response", interim.next(), HTTP1_INFORMATIONAL);
  t.eqI32("its status", interim.status, toI32(103));
  t.eqStr("its fields, by name in any case", headerText(interim, "LINK"), "</a>");
  interim.expect(false, false);
  const final: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n");
  interim.feed(final, zero, toI32(final.length));
  t.eqI32("expect after an interim response does nothing: HEAD still holds", interim.next(), HTTP1_HEAD);
  t.eqI32("so the 200 has no body", interim.next(), HTTP1_END);
  t.eqStr("a field that is not there is null", headerText(interim, "link"), "null");
  t.eqStr("the reason phrase", interim.reason, "OK");

  const tunnel: Http1ResponseParser = smallParser();
  t.eqStr("a tunnel", outcomeOf(tunnel, "HTTP/1.1 200 OK\r\n\r\nab", toConnect()), "ends 1, error 0");
  t.eqI32("answers HTTP1_UPGRADE", tunnel.next(), HTTP1_UPGRADE);
  const more: u8[] = bytesOf("cd");
  tunnel.feed(more, zero, toI32(more.length));
  t.eqI32("and again", tunnel.next(), HTTP1_UPGRADE);
  const tunnelled: u8[] = tunnel.tunnelBytes();
  t.eqStr("tunnelBytes() holds what was fed past the head, then and later", textOf(tunnelled, zero, toI32(tunnelled.length)), "abcd");
  t.ok("a tunnel is not kept alive", !tunnel.keepAlive());
  t.eqI32("tunnelBytes() outside a tunnel is empty", toI32(smallParser().tunnelBytes().length), zero);
  const midway: Http1ResponseParser = smallParser();
  const partBody: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhel");
  midway.feed(partBody, zero, toI32(partBody.length));
  t.eqI32("a response part-read", midway.next(), HTTP1_HEAD);
  t.eqI32("tunnelBytes() mid-response is empty, with bytes buffered", toI32(midway.tunnelBytes().length), zero);
  const notConnect: Http1ResponseParser = smallParser();
  const pastEnd: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\nabcd");
  notConnect.feed(pastEnd, zero, toI32(pastEnd.length));
  t.eqI32("a 200 to a request that was not CONNECT", notConnect.next(), HTTP1_HEAD);
  t.eqI32("ends", notConnect.next(), HTTP1_END);
  t.eqI32("tunnelBytes() after it is empty, with bytes past it buffered", toI32(notConnect.tunnelBytes().length), zero);

  // --- The limits ------------------------------------------------------------
  const status20: string = "HTTP/1.1 204 OKAYYYY";
  atCap(t, "the status line", zero, toI32(status20.length), `${status20}\r\n\r\n`, plain(), HTTP1_E_STATUS_LINE_LIMIT);
  const head1: string = "Content-Length: 0\r\nX-Padding: abcdefgh\r\n\r\n";
  atCap(t, "the header section", toI32(1), toI32(head1.length), `HTTP/1.1 200 OK\r\n${head1}`, plain(), HTTP1_E_HEADER_LIMIT);
  atCap(t, "the field count", toI32(2), toI32(3), "HTTP/1.1 200 OK\r\nA: 1\r\nB: 2\r\nContent-Length: 0\r\n\r\n", plain(), HTTP1_E_COUNT_LIMIT);
  atCap(t, "the field count, trailers included", toI32(2), toI32(3), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nA: 1\r\nB: 2\r\n\r\n", plain(), HTTP1_E_COUNT_LIMIT);
  atCap(t, "a Content-Length body", toI32(3), toI32(5), "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello", plain(), HTTP1_E_BODY_LIMIT);
  atCap(t, "a chunked body", toI32(3), toI32(11), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n", plain(), HTTP1_E_BODY_LIMIT);
  atCap(t, "a body read until close", toI32(3), toI32(5), "HTTP/1.1 200 OK\r\n\r\nhello", closing(), HTTP1_E_BODY_LIMIT);
  t.eqStr("the Content-Length body at the limit, whole", transcriptWith(limitedParser(toI32(3), toI32(5)), "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello", plain()), '200 1.1 keep length 5 [content-length=5]\nbody "hello"\nneeds more');
  t.eqStr(
    "the chunked body at the limit, whole",
    transcriptWith(limitedParser(toI32(3), toI32(11)), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n", plain()),
    '200 1.1 keep chunked [transfer-encoding=chunked]\nbody "hello world"\nneeds more'
  );
  t.eqStr("the body read until close at the limit, whole", transcriptWith(limitedParser(toI32(3), toI32(5)), "HTTP/1.1 200 OK\r\n\r\nhello", closing()), '200 1.1 close length -1 []\nbody "hello"\nclosed');
  const trailer1: string = "Expires: never\r\n\r\n";
  atCap(t, "the trailer section", toI32(4), toI32(trailer1.length), `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n${trailer1}`, plain(), HTTP1_E_TRAILER_LIMIT);
  t.eqStr(
    "a Content-Length over the body limit on a response to HEAD is not refused",
    outcomeOf(limitedParser(toI32(3), toI32(5)), "HTTP/1.1 200 OK\r\nContent-Length: 99999999999999999999999999\r\n\r\n", toHead()),
    "ends 1, error 0"
  );
  t.eqStr(
    "a Content-Length past 2^63 is over the body limit, not wrapped",
    outcomeOf(limitedParser(toI32(3), toI32(5)), "HTTP/1.1 200 OK\r\nContent-Length: 99999999999999999999999999\r\n\r\n", plain()),
    `ends 0, error ${HTTP1_E_BODY_LIMIT}`
  );
  const zeroLimits: Http1ResponseParser = new Http1ResponseParser(toI32(-5), toI32(-5), toI32(-5), toI64(-5), toI32(-5));
  t.eqStr("negative limits are clamped to 0", outcomeOf(zeroLimits, "HTTP/1.1 204 No Content\r\n\r\n", plain()), `ends 0, error ${HTTP1_E_STATUS_LINE_LIMIT}`);
  // One negative limit at a time, the others sane: each reads as 0.
  const minusFive: i32 = -5;
  t.eqStr("a negative maxHeaderBytes is 0", outcomeOf(limitedParser(toI32(1), minusFive), "HTTP/1.1 204 No Content\r\n\r\n", plain()), `ends 0, error ${HTTP1_E_HEADER_LIMIT}`);
  t.eqStr("a negative maxHeaders is 0: no field", outcomeOf(limitedParser(toI32(2), minusFive), "HTTP/1.1 204 No Content\r\n\r\n", plain()), "ends 1, error 0");
  t.eqStr("but one", outcomeOf(limitedParser(toI32(2), minusFive), "HTTP/1.1 204 No Content\r\nA: 1\r\n\r\n", plain()), `ends 0, error ${HTTP1_E_COUNT_LIMIT}`);
  t.eqStr(
    "a negative maxBody is 0: a Content-Length of 0 is read",
    transcriptWith(limitedParser(toI32(3), minusFive), "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n", plain()),
    "200 1.1 keep length 0 [content-length=0]\nbody \"\"\nneeds more"
  );
  t.eqStr(
    "an empty chunked body",
    transcriptWith(limitedParser(toI32(3), minusFive), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", plain()),
    "200 1.1 keep chunked [transfer-encoding=chunked]\nbody \"\"\nneeds more"
  );
  t.eqStr("an empty body read until close", transcriptWith(limitedParser(toI32(3), minusFive), "HTTP/1.1 200 OK\r\n\r\n", closing()), "200 1.1 close length -1 []\nbody \"\"\nclosed");
  t.eqStr("but a byte of body is over it", outcomeOf(limitedParser(toI32(3), minusFive), "HTTP/1.1 200 OK\r\nContent-Length: 1\r\n\r\nx", plain()), `ends 0, error ${HTTP1_E_BODY_LIMIT}`);
  t.eqStr(
    "a negative maxTrailerBytes is 0",
    outcomeOf(limitedParser(toI32(4), minusFive), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", plain()),
    `ends 0, error ${HTTP1_E_TRAILER_LIMIT}`
  );

  // A line longer than what is left of its section's budget is refused as it
  // is found, before its bare LF is judged; the budget is what the lines
  // before it left.
  const longField: string = `X-Long: ${repeat("a", 245)}`;
  refused(t, "a field line past what the section has left, ended in a bare LF", `HTTP/1.1 200 OK\r\nA: 1\r\n${longField}\n\r\n`, plain(), HTTP1_E_HEADER_LIMIT);
  refused(t, "the same line, ended in CRLF", `HTTP/1.1 200 OK\r\nA: 1\r\n${longField}\r\n\r\n`, plain(), HTTP1_E_HEADER_LIMIT);
  refused(t, "the same line, its end not yet arrived", `HTTP/1.1 200 OK\r\nA: 1\r\n${longField}`, plain(), HTTP1_E_HEADER_LIMIT);
  const longTrailer: string = `X-Long: ${repeat("a", 53)}`;
  const chunkedEnd: string = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nA: 1\r\n";
  refused(t, "a trailer line past what the section has left, ended in a bare LF", `${chunkedEnd}${longTrailer}\n\r\n`, plain(), HTTP1_E_TRAILER_LIMIT);
  refused(t, "the same trailer, ended in CRLF", `${chunkedEnd}${longTrailer}\r\n\r\n`, plain(), HTTP1_E_TRAILER_LIMIT);
  refused(t, "the same trailer, its end not yet arrived", `${chunkedEnd}${longTrailer}`, plain(), HTTP1_E_TRAILER_LIMIT);

  // The upper clamps: an i32 limit to 2^30, so that a line's limit plus one
  // does not wrap, and maxBody to 2^53.
  const most: i32 = 2147483647;
  const huge: i64 = toI64(1) << toI64(62);
  t.eqStr(
    "the largest limits read an ordinary response",
    transcriptWith(new Http1ResponseParser(most, most, most, huge, most), "HTTP/1.1 200 OK\r\nX-A: b\r\nContent-Length: 2\r\n\r\nok", plain()),
    '200 1.1 keep length 2 [x-a=b; content-length=2]\nbody "ok"\nneeds more'
  );
  t.eqStr(
    "a Content-Length of 2^53 is under a clamped maxBody",
    transcriptWith(new Http1ResponseParser(most, most, most, huge, most), "HTTP/1.1 200 OK\r\nContent-Length: 9007199254740992\r\n\r\n", plain()),
    '200 1.1 keep length 9007199254740992 [content-length=9007199254740992]\nneeds more'
  );
  t.eqStr(
    "one of 2^53 + 1 is over it",
    transcriptWith(new Http1ResponseParser(most, most, most, huge, most), "HTTP/1.1 200 OK\r\nContent-Length: 9007199254740993\r\n\r\n", plain()),
    `error ${HTTP1_E_BODY_LIMIT}`
  );
  t.eqStr(
    "the largest limits read a chunked body and its trailers",
    transcriptWith(new Http1ResponseParser(most, most, most, huge, most), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\n0\r\nX-T: 1\r\n\r\n", plain()),
    '200 1.1 keep chunked [transfer-encoding=chunked]\nbody "ok"\nneeds more'
  );

  const chunkLine: string = `1;${repeat("a", HTTP1_MAX_CHUNK_LINE - 2)}`;
  const chunkHead: string = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n";
  t.eqStr(
    `a chunk-size line of exactly HTTP1_MAX_CHUNK_LINE (${HTTP1_MAX_CHUNK_LINE}) bytes`,
    outcomeOf(limitedParser(zero, toI32(64)), `${chunkHead}${chunkLine}\r\nx\r\n0\r\n\r\n`, plain()),
    "ends 1, error 0"
  );
  t.eqStr(
    "one byte longer",
    outcomeOf(limitedParser(zero, toI32(64)), `${chunkHead}${chunkLine}a\r\nx\r\n0\r\n\r\n`, plain()),
    `ends 0, error ${HTTP1_E_CHUNK_LINE_LIMIT}`
  );
  const continues: string = repeat("HTTP/1.1 100 Continue\r\n\r\n", HTTP1_MAX_INFORMATIONAL);
  t.eqStr(
    `exactly HTTP1_MAX_INFORMATIONAL (${HTTP1_MAX_INFORMATIONAL}) interim responses`,
    outcomeOf(smallParser(), `${continues}HTTP/1.1 204 No Content\r\n\r\n`, plain()),
    "ends 1, error 0"
  );
  t.eqStr(
    "one more",
    outcomeOf(smallParser(), `${continues}HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n`, plain()),
    `ends 0, error ${HTTP1_E_INFORMATIONAL_LIMIT}`
  );
  const twoFinals: string = `${continues}HTTP/1.1 204 No Content\r\n\r\n${continues}HTTP/1.1 204 No Content\r\n\r\n`;
  t.eqStr("the interim count starts again for each request", outcomeOf(smallParser(), twoFinals, plain()), "ends 2, error 0");

  // --- The writer ------------------------------------------------------------
  const none: i64 = toI64(HTTP1_NO_BODY);
  const chunked: i64 = toI64(HTTP1_CHUNKED);
  const empty: i64 = 0;
  t.eqStr(
    "a GET with no body has no framing field",
    headText(http1RequestHead("GET", "/index.html?q=1", ["Host", "Accept"], ["example.com", "*/*"], none)),
    "GET /index.html?q=1 HTTP/1.1\r\nHost: example.com\r\nAccept: */*\r\n\r\n"
  );
  t.eqStr(
    "Host goes first, whatever its case and place",
    headText(http1RequestHead("GET", "/", ["Accept", "hOST"], ["*/*", "example.com:8080"], none)),
    "GET / HTTP/1.1\r\nhOST: example.com:8080\r\nAccept: */*\r\n\r\n"
  );
  t.eqStr("an empty Host is written", headText(http1RequestHead("GET", "/", ["Host"], [""], none)), "GET / HTTP/1.1\r\nHost: \r\n\r\n");
  t.eqStr("a POST with an empty body says Content-Length: 0", requestWith("POST", "/form", "", "", empty), "POST /form HTTP/1.1\r\nHost: example.com\r\nContent-Length: 0\r\n\r\n");
  const big: i64 = 1234567890123;
  t.eqStr("a Content-Length past 32 bits", requestWith("PUT", "/blob", "", "", big), "PUT /blob HTTP/1.1\r\nHost: example.com\r\nContent-Length: 1234567890123\r\n\r\n");
  t.eqStr(
    "a chunked body goes last, after the caller's fields",
    requestWith("POST", "/upload", "Content-Type", "text/plain", chunked),
    "POST /upload HTTP/1.1\r\nHost: example.com\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\n\r\n"
  );
  t.eqStr("absolute-form, for a proxy", requestWith("GET", "http://example.com/x", "", "", none), "GET http://example.com/x HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("absolute-form with an uppercase scheme", requestWith("GET", "HTTP://example.com/", "", "", none), "GET HTTP://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("a host and port for GET is well-formed absolute-form", requestWith("GET", "example.com:80", "", "", none), "GET example.com:80 HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("authority-form, for CONNECT", requestWith("CONNECT", "example.com:443", "", "", none), "CONNECT example.com:443 HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("authority-form with a bracketed IPv6 host", requestWith("CONNECT", "[::1]:8443", "", "", none), "CONNECT [::1]:8443 HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("asterisk-form, for OPTIONS", requestWith("OPTIONS", "*", "", "", none), "OPTIONS * HTTP/1.1\r\nHost: example.com\r\n\r\n");
  t.eqStr("a Connection: close is written", requestWith("GET", "/", "Connection", "close", none), "GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n");

  t.eqStr("refused: a method that is not a token", requestWith("GE T", "/", "", "", none), "null");
  t.eqStr("refused: an empty method", requestWith("", "/", "", "", none), "null");
  t.eqStr("refused: an empty target", requestWith("GET", "", "", "", none), "null");
  t.eqStr("refused: a space in the target", requestWith("GET", "/a b", "", "", none), "null");
  t.eqStr("refused: a CRLF in the target", requestWith("GET", "/a\r\nX-Injected: 1", "", "", none), "null");
  t.eqStr("refused: a fragment", requestWith("GET", "/a#top", "", "", none), "null");
  t.eqStr("refused: a DEL in the target", requestWith("GET", "/a\u007f", "", "", none), "null");
  t.eqStr("refused: a byte above 0x7E in the target", requestWith("GET", `/${String.fromCharCode(toI32(200))}`, "", "", none), "null");
  t.eqStr("refused: a relative target", requestWith("GET", "index.html", "", "", none), "null");
  t.eqStr("refused: a target that starts with a digit", requestWith("GET", "1http:x", "", "", none), "null");
  t.eqStr("refused: a scheme with a byte no scheme holds", requestWith("GET", "ht_tp://x", "", "", none), "null");
  t.eqStr("refused: an asterisk for GET", requestWith("GET", "*", "", "", none), "null");
  t.eqStr("refused: an asterisk with more after it", requestWith("OPTIONS", "*/", "", "", none), "null");
  t.eqStr("refused: CONNECT with no port", requestWith("CONNECT", "example.com", "", "", none), "null");
  t.eqStr("refused: CONNECT with an empty port", requestWith("CONNECT", "example.com:", "", "", none), "null");
  t.eqStr("refused: CONNECT with no host", requestWith("CONNECT", ":443", "", "", none), "null");
  t.eqStr("refused: CONNECT with a six-digit port", requestWith("CONNECT", "example.com:100000", "", "", none), "null");
  t.eqStr("refused: CONNECT with a letter in the port", requestWith("CONNECT", "example.com:44a", "", "", none), "null");
  t.eqStr("refused: CONNECT with userinfo", requestWith("CONNECT", "user@example.com:443", "", "", none), "null");
  t.eqStr("refused: CONNECT with a path", requestWith("CONNECT", "example.com:443/x", "", "", none), "null");
  t.eqStr("refused: CONNECT with a query", requestWith("CONNECT", "example.com?:443", "", "", none), "null");
  t.eqStr("refused: CONNECT with origin-form", requestWith("CONNECT", "/", "", "", none), "null");
  t.eqStr("refused: a field name that is not a token", requestWith("GET", "/", "X Bad", "1", none), "null");
  t.eqStr("refused: an empty field name", headText(http1RequestHead("GET", "/", ["Host", ""], ["example.com", "1"], none)), "null");
  t.eqStr("refused: a CRLF in a value", requestWith("GET", "/", "X-A", "1\r\nX-Injected: 2", none), "null");
  t.eqStr("refused: a bare LF in a value", requestWith("GET", "/", "X-A", "1\nX-Injected: 2", none), "null");
  t.eqStr("refused: a NUL in a value", requestWith("GET", "/", "X-A", "1\u00002", none), "null");
  t.eqStr("refused: the caller's own Content-Length", requestWith("POST", "/", "Content-Length", "5", none), "null");
  t.eqStr("refused: the caller's own Transfer-Encoding, in any case", requestWith("POST", "/", "TRANSFER-encoding", "chunked", none), "null");
  t.eqStr("refused: a Connection that lists upgrade", requestWith("GET", "/", "Connection", "keep-alive, Upgrade", none), "null");
  const upgradeRoom: u8[] = new Array<u8>(256);
  t.eqI32(
    "refused: http1WriteRequestHead with a Connection that lists upgrade",
    http1WriteRequestHead(upgradeRoom, zero, "GET", "/", ["Host", "Connection"], ["example.com", "Upgrade"], none),
    HTTP1_REFUSED
  );
  t.eqStr(
    "http1UpgradeRequestHead writes Upgrade and Connection itself",
    headText(http1UpgradeRequestHead("GET", "/chat", ["Host", "Sec-WebSocket-Version"], ["example.com", "13"], "websocket")),
    "GET /chat HTTP/1.1\r\nHost: example.com\r\nSec-WebSocket-Version: 13\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
  );
  t.eqStr("refused upgrade: an empty protocol", headText(http1UpgradeRequestHead("GET", "/", ["Host"], ["example.com"], "")), "null");
  t.eqStr("refused upgrade: a protocol that is not a token", headText(http1UpgradeRequestHead("GET", "/", ["Host"], ["example.com"], "web socket")), "null");
  t.eqStr("refused upgrade: CR LF in the protocol", headText(http1UpgradeRequestHead("GET", "/", ["Host"], ["example.com"], "ws\r\nX: 1")), "null");
  t.eqStr(
    "refused upgrade: the caller's own Connection",
    headText(http1UpgradeRequestHead("GET", "/", ["Host", "Connection"], ["example.com", "keep-alive"], "websocket")),
    "null"
  );
  t.eqStr(
    "refused upgrade: the caller's own Upgrade, in any case",
    headText(http1UpgradeRequestHead("GET", "/", ["Host", "uPGRADE"], ["example.com", "h2c"], "websocket")),
    "null"
  );
  t.eqStr("refused upgrade: no Host", headText(http1UpgradeRequestHead("GET", "/", ["Accept"], ["*/*"], "websocket")), "null");
  t.eqStr("refused: no Host", headText(http1RequestHead("GET", "/", ["Accept"], ["*/*"], none)), "null");
  t.eqStr("refused: two Hosts", requestWith("GET", "/", "host", "evil.example", none), "null");
  t.eqStr("refused: names and values of different lengths", headText(http1RequestHead("GET", "/", ["Host", "Accept"], ["example.com"], none)), "null");
  const belowNone: i64 = -3;
  t.eqStr("refused: a body length below -2", requestWith("POST", "/", "", "", belowNone), "null");
  // Thirty-two fields sharing one 64 MiB value pass every per-field check but
  // sum past the 2^30-byte head an array holds, and past 2^31 too, where an
  // i32 sum would wrap.
  let wide: string = "a";
  for (let i: i32 = 0; i < 26; i += 1) {
    wide = `${wide}${wide}`;
  }
  const wideNames: string[] = ["Host"];
  const wideValues: string[] = ["example.com"];
  for (let i: i32 = 0; i < 32; i += 1) {
    wideNames.push("X");
    wideValues.push(wide);
  }
  t.eqStr("refused: a head past 2^30 bytes", headText(http1RequestHead("GET", "/", wideNames, wideValues, none)), "null");

  const names: string[] = ["Host", "Accept"];
  const values: string[] = ["example.com", "*/*"];
  const exact: string = "GET / HTTP/1.1\r\nHost: example.com\r\nAccept: */*\r\n\r\n";
  const size: i32 = toI32(exact.length);
  const fits: u8[] = new Array<u8>(size);
  t.eqI32("http1WriteRequestHead fills a buffer exactly its size", http1WriteRequestHead(fits, zero, "GET", "/", names, values, none), size);
  t.eqStr("with the same bytes", textOf(fits, zero, size), exact);
  const three: i32 = 3;
  const offset: u8[] = new Array<u8>(size + three);
  t.eqI32("at an offset it answers where it ends", http1WriteRequestHead(offset, three, "GET", "/", names, values, none), size + three);
  t.eqStr("and writes from there", textOf(offset, three, size), exact);
  const short: u8[] = new Array<u8>(size - 1);
  t.eqI32("one byte short is HTTP1_NO_ROOM", http1WriteRequestHead(short, zero, "GET", "/", names, values, none), HTTP1_NO_ROOM);
  t.eqI32("and writes nothing", toI32(short[0]), zero);
  const minusOne: i32 = -1;
  t.eqI32("a negative offset is HTTP1_NO_ROOM", http1WriteRequestHead(offset, minusOne, "GET", "/", names, values, none), HTTP1_NO_ROOM);
  t.eqI32("an offset past the end is HTTP1_NO_ROOM", http1WriteRequestHead(offset, size + three + 1, "GET", "/", names, values, none), HTTP1_NO_ROOM);
  t.eqI32("a refusal is HTTP1_REFUSED, even with no room", http1WriteRequestHead(short, zero, "GET", "/a b", names, values, none), HTTP1_REFUSED);
  t.eqI32("and writes nothing", toI32(short[0]), zero);

  // The server parser reads the writer's head as the request it is.
  const server: Http1Parser = new Http1Parser(toI32(64), toI32(512), toI32(16), toI32(1024));
  const wire: u8[] = bytesOf(requestWith("POST", "/upload", "Content-Type", "text/plain", chunked));
  for (const b of bytesOf("5\r\nhello\r\n0\r\n\r\n")) {
    wire.push(b);
  }
  server.feed(wire, zero, toI32(wire.length));
  t.eqI32("the server parser reads the head", server.next(), HTTP1_HEAD);
  t.ok("as a chunked POST", server.chunked && server.method === "POST" && server.target === "/upload");
  t.eqI32("with its body", server.next(), HTTP1_BODY);
  t.eqI32("to its end", server.next(), HTTP1_END);

  // --- The mutation sweep's survivors -----------------------------------------
  // Each check below fails under a mechanical mutant of the parser or the
  // writer that every other check passes: an operand of `&&` or `||` deleted,
  // a comparison's boundary moved by one, or a reset or clamp dropped.
  // `docs/security/http1-client.md` → "Every condition is observed" lists the
  // mutants that change nothing a caller can see, and why.

  // The status line: 599 is the last status a response may carry.
  accepted(t, "a status of 599", "HTTP/1.1 599 Last\r\nContent-Length: 0\r\n\r\n", plain());

  // A negative limit is clamped to 0, so an empty line is within it and is
  // refused as a status line; read unclamped, even an empty line is over it.
  const belowZero: i32 = -5;
  t.eqStr("a negative status-line limit is clamped to 0", outcomeOf(limitedParser(zero, belowZero), "\r\n", plain()), `ends 0, error ${HTTP1_E_STATUS_LINE}`);

  // `expect` mid-response does nothing: the response that is being read
  // answers the request it answered.
  const midResponse: Http1ResponseParser = corpusParser();
  const midwayText: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi");
  midResponse.expect(false, false);
  midResponse.feed(midwayText, zero, toI32(midwayText.length));
  t.eqI32("expect mid-response: the head", midResponse.next(), HTTP1_HEAD);
  midResponse.expect(false, true);
  t.eqI32("expect mid-response: the body", midResponse.next(), HTTP1_BODY);
  t.eqI32("expect mid-response: an end, not a tunnel", midResponse.next(), HTTP1_END);
  t.eqI32("expect mid-response: then waiting for the next", midResponse.next(), HTTP1_NEED_MORE);

  // A response's end forgets its `expect`: the next response answers a GET
  // unless the caller says otherwise.
  t.eqStr(
    "a response after a HEAD's, with no fresh expect, has its body",
    firstAsked(corpusParser(), "HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc", toHead()),
    '200 1.1 keep length -1 [content-length=3]\nbody ""\n200 1.1 keep length 3 [content-length=3]\nbody "abc"\nneeds more'
  );
  t.eqStr(
    "a 2xx after a refused CONNECT's, with no fresh expect, is no tunnel",
    firstAsked(corpusParser(), "HTTP/1.1 407 No\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n", toConnect()),
    '407 1.1 keep length 0 [content-length=0]\nbody ""\n200 1.1 keep length 0 [content-length=0]\nbody ""\nneeds more'
  );
  // A 300 to CONNECT is a redirect, not a tunnel.
  t.eqStr(
    "a 300 to CONNECT is read as a response",
    transcriptWith(corpusParser(), "HTTP/1.1 300 Elsewhere\r\nContent-Length: 0\r\n\r\n", toConnect()),
    '300 1.1 keep length 0 [content-length=0]\nbody ""\nneeds more'
  );

  // Bytes fed after `finish()` are dropped, even before `next()` reads the close.
  const afterFinish: Http1ResponseParser = corpusParser();
  const afterFinishHead: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhel");
  const afterFinishRest: u8[] = bytesOf("lo");
  afterFinish.expect(false, false);
  afterFinish.feed(afterFinishHead, zero, toI32(afterFinishHead.length));
  afterFinish.finish();
  afterFinish.feed(afterFinishRest, zero, toI32(afterFinishRest.length));
  t.eqI32("bytes fed after finish() are dropped", toI32(afterFinish.buffered()), toI32(afterFinishHead.length));
  const afterFinishLog: Transcript = new Transcript();
  drain(afterFinish, afterFinishLog, plain());
  t.eqStr("so the body is cut short", ending(afterFinish, afterFinishLog), `200 1.1 keep length 5 [content-length=5]\npartial body "hel"\nerror ${HTTP1_E_TRUNCATED}`);

  // Each response's header section has its own byte and field budget, and so
  // does a final response after a 1xx.
  const twice: string = `HTTP/1.1 200 OK\r\n${head1}HTTP/1.1 200 OK\r\n${head1}`;
  atCapEach(t, "the header section, of each of two responses", toI32(1), toI32(head1.length), twice, toI32(2), HTTP1_E_HEADER_LIMIT);
  const hint1: string = "X-Hint: 000000000\r\nX-Padding: abcdefgh\r\n\r\n";
  atCapEach(t, "the header section, of a 1xx and its final response", toI32(1), toI32(head1.length), `HTTP/1.1 103 Hints\r\n${hint1}HTTP/1.1 200 OK\r\n${head1}`, toI32(1), HTTP1_E_HEADER_LIMIT);
  const threeFields: string = "HTTP/1.1 200 OK\r\nA: 1\r\nB: 2\r\nContent-Length: 0\r\n\r\n";
  atCapEach(t, "the field count, of each of two responses", toI32(2), toI32(3), `${threeFields}${threeFields}`, toI32(2), HTTP1_E_COUNT_LIMIT);
  atCapEach(t, "the field count, of a 1xx and its final response", toI32(2), toI32(3), `HTTP/1.1 103 Hints\r\nA: 1\r\nB: 2\r\nC: 3\r\n\r\n${threeFields}`, toI32(1), HTTP1_E_COUNT_LIMIT);
  // And its own body budget: 40 bytes each, under smallParser's 64 apiece.
  const forty: string = repeat("x", toI32(40));
  const chunked40: string = `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n28\r\n${forty}\r\n0\r\n\r\n`;
  t.eqStr("a chunked body budget, for each of two responses", outcomeOf(smallParser(), `${chunked40}${chunked40}`, plain()), "ends 2, error 0");

  // A status line read after a kept-alive response starts from nothing: a
  // malformed one leaves no status, reason, version, field or framing of the
  // response before it.
  t.eqStr(
    "a malformed status line after a 1.0 keep-alive response",
    afterSecondLine("HTTP/1.0 404 Gone\r\nConnection: keep-alive\r\nContent-Length: 3\r\n\r\nabcHTTP/1.1 2x0 Bad\r\n"),
    `0 1.1 "" [] length -1 bodyLen 0 close, error ${HTTP1_E_STATUS_LINE}`
  );
  t.eqStr(
    "a malformed status line after a chunked response",
    afterSecondLine("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n0\r\n\r\nHTTP/1.1 2x0 Bad\r\n"),
    `0 1.1 "" [] length -1 bodyLen 0 close, error ${HTTP1_E_STATUS_LINE}`
  );
  const between: Http1ResponseParser = corpusParser();
  const betweenText: u8[] = bytesOf("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK\r\nX-A: 1\r\n");
  between.expect(false, false);
  between.feed(betweenText, zero, toI32(betweenText.length));
  between.next();
  between.next();
  t.ok("the first response may be followed by another", between.keepAlive());
  between.expect(false, false);
  t.eqI32("the second's head is not in yet", between.next(), HTTP1_NEED_MORE);
  t.ok("and until it is, keepAlive() is false", !between.keepAlive());

  // A refusal is never followed by a request on the same connection.
  const refusal: Http1ResponseParser = smallParser();
  outcomeOf(refusal, "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n41\r\n", plain());
  t.eqI32("a chunk over the body limit is refused", refusal.error, HTTP1_E_BODY_LIMIT);
  t.ok("and the connection is not kept alive", !refusal.keepAlive());

  // A line cut by a feed that moves the live bytes down is still found: the
  // first feed fills the first buffer exactly, ten bytes of the next status
  // line already scanned, so the rest moves them to the front, and the scan
  // must move with them.
  const moved: string = `HTTP/1.1 200 OK\r\nContent-Length: 974\r\n\r\n${repeat("y", toI32(974))}`;
  const movedData: u8[] = bytesOf(`${moved}HTTP/1.1 204 None\r\n\r\n`);
  const movedCut: i32 = toI32(moved.length) + 10;
  t.eqI32("the first feed is the first buffer", movedCut, HTTP1_FIRST_INPUT);
  t.eqStr(
    "a status line split by a feed that moves the buffer",
    transcriptSplitAt(movedData, movedCut, plain()),
    `200 1.1 keep length 974 [content-length=974]\nbody "${repeat("y", toI32(974))}"\n204 1.1 keep length -1 []\nbody ""\nneeds more`
  );

  // A bare LF where a line starts: the stream's first byte, and the CRLF
  // after chunk data whose last byte is a CR.
  refused(t, "an LF as the stream's first byte", "\nHTTP/1.1 200 OK\r\n\r\n", plain(), HTTP1_E_BARE_LF);
  refused(t, "a bare LF after chunk data that ends in CR", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nabc\r\n0\r\n\r\n", plain(), HTTP1_E_BARE_LF);

  // `header` answers the first of a repeated field, and `null` for none.
  const twoOf: Http1ResponseParser = corpusParser();
  const twoOfText: u8[] = bytesOf("HTTP/1.1 200 OK\r\nX-A: first\r\nx-a: second\r\nContent-Length: 0\r\n\r\n");
  twoOf.expect(false, false);
  twoOf.feed(twoOfText, zero, toI32(twoOfText.length));
  twoOf.next();
  t.eqStr("header() answers the first of two fields", headerText(twoOf, "X-A"), "first");
  t.eqStr("header() answers null for an absent field", headerText(twoOf, "X-B"), "null");

  // Framing: a Content-Length byte just below the digits, a list that starts
  // with 0, 2^53 given twice, and Connection words in other fields or in 1.0.
  refused(t, "a Content-Length with a / after its digits", "HTTP/1.1 200 OK\r\nContent-Length: 1/\r\n\r\n", plain(), HTTP1_E_LENGTH);
  refused(t, "a Content-Length list of 0 and 5", "HTTP/1.1 200 OK\r\nContent-Length: 0, 5\r\n\r\n", plain(), HTTP1_E_LENGTH);
  const largestBody: i64 = 9007199254740992;
  const atMaxBody: Http1ResponseParser = new Http1ResponseParser(toI32(64), toI32(512), toI32(16), largestBody, toI32(128));
  t.eqStr(
    "a Content-Length of 2^53 given twice, to a HEAD",
    transcriptWith(atMaxBody, "HTTP/1.1 200 OK\r\nContent-Length: 9007199254740992, 9007199254740992\r\n\r\n", toHead()),
    '200 1.1 keep length -1 [content-length=9007199254740992, 9007199254740992]\nbody ""\nneeds more'
  );
  t.eqStr("a close in another field keeps a 1.1 response alive", transcriptWith(corpusParser(), "HTTP/1.1 200 OK\r\nX-A: close\r\nContent-Length: 0\r\n\r\n", plain()), '200 1.1 keep length 0 [x-a=close; content-length=0]\nbody ""\nneeds more');
  t.eqStr(
    "a 1.0 response listing keep-alive and close closes",
    transcriptWith(corpusParser(), "HTTP/1.0 200 OK\r\nConnection: keep-alive, close\r\nContent-Length: 0\r\n\r\n", plain()),
    '200 1.0 close length 0 [connection=keep-alive, close; content-length=0]\nbody ""\nclosed'
  );

  // The writer: a two-digit Content-Length, every scheme byte and the bytes
  // next to their ranges, the first letter's range, and CONNECT's ports.
  t.eqStr("a POST of 10 bytes says Content-Length: 10", requestWith("POST", "/", "", "", toI64(10)), "POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 10\r\n\r\n");
  const nameOnly: string[] = ["Host"];
  const hostOnly: string[] = ["example.com"];
  const okTargets: string[] = ["azAZ09+-.:x", "a:x", "z:x", "A:x", "Z:x"];
  for (const target of okTargets) {
    t.ok(`the absolute-form target ${target} is written`, http1RequestHead("GET", target, nameOnly, hostOnly, none) !== null);
  }
  const badTargets: string[] = ["a{:x", "a`:x", "a[:x", "a@:x", "a/:x", "a;:x", "a,:x", "a*:x", "{:x", "[:x", "@:x", "`:x"];
  for (const target of badTargets) {
    t.ok(`the target ${target} is refused`, http1RequestHead("GET", target, nameOnly, hostOnly, none) === null);
  }
  const okPorts: string[] = ["h:65535", "a:9", "a:1", "a:90", "host:65530"];
  for (const target of okPorts) {
    t.ok(`CONNECT ${target} is written`, http1RequestHead("CONNECT", target, nameOnly, hostOnly, none) !== null);
  }
  const badPorts: string[] = ["a/b:80", "a:8.0", "a:", ":80", "a:123456"];
  for (const target of badPorts) {
    t.ok(`CONNECT ${target} is refused`, http1RequestHead("CONNECT", target, nameOnly, hostOnly, none) === null);
  }
  t.ok("a field whose value is upgrade is written when it is not Connection", requestWith("GET", "/", "X-A", "upgrade", none) !== "null");

  t.eqI32("HTTP1_E_NONE is 0, before anything goes wrong", smallParser().error, HTTP1_E_NONE);
  return t.done();
};
