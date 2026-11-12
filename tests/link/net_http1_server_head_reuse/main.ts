// `Http1Connection.respond` keeps a final head it has written twice running
// (the same status, framing, `Connection` and number of fields) and copies it
// when the next is the same: the same fields too, in the same second. These
// checks drive connections with no socket and read every response byte for byte against
// `http1WriteResponseHead` called directly, so a copied head is shown to be
// the head the writer would have written, and a head that differs in any
// input (a status, a field's name or value, its order, a length, the
// `Connection` the request asked for, the second) to be written fresh.
// `headCopies` tells the two apart.
import { HTTP1_CHUNKED, HTTP1_NO_BODY, http1WriteResponseHead } from "nish/net/http1-codec";
import { H1_AGAIN, H1_INVALID, H1_REQUEST, H1_WRITE, Http1Config, Http1Connection } from "nish/net/http1-server";
import { Suite } from "nish/testing";

const ZERO: i32 = 0;
const PINNED_MS: i64 = 1792138314000;

/** `text` as bytes, one per UTF-16 unit: the checks spell only ASCII. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** `bytes[from .. to)` as a string, one unit per byte. */
const latin1 = (bytes: u8[], from: i32, to: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = from; k < to; k++) {
    parts.push(String.fromCharCode(toI32(bytes[k])));
  }
  return parts.join("");
};

/** Each of `texts` as bytes. */
const fields = (texts: string[]): u8[][] => {
  const out: u8[][] = [];
  for (const text of texts) {
    out.push(ascii(text));
  }
  return out;
};

const config = (): Http1Config => {
  const c = new Http1Config();
  c.maxTarget = 256;
  c.maxHeaderBytes = 1024;
  c.outputSize = 8192;
  return c;
};

/** A connection fed `text` whole, its date pinned. */
const fed = (text: string): Http1Connection => {
  const conn = new Http1Connection(config());
  conn.date.pin(PINNED_MS);
  const bytes: u8[] = ascii(text);
  conn.feed(bytes, ZERO, toI32(bytes.length));
  return conn;
};

/** Everything the connection has queued, taken off it. */
const drained = (conn: Http1Connection): string => {
  const text: string = latin1(conn.output, conn.outputStart, conn.outputEnd);
  conn.consume(conn.outputEnd - conn.outputStart);
  return text;
};

/** The head `http1WriteResponseHead` writes for these inputs. */
const head = (status: i32, reason: string, names: u8[][], values: u8[][], length: i32, connection: string, date: u8[]): string => {
  const out: u8[] = new Array<u8>(8192);
  const end: i32 = http1WriteResponseHead(out, ZERO, status, reason, names, values, length, connection, date);
  return end < 0 ? `refused ${end}` : latin1(out, ZERO, end);
};

/** Moves `conn` to its next request: true when one is there. */
const nextRequest = (conn: Http1Connection): boolean => {
  for (let k: i32 = 0; k < 4; k++) {
    if (conn.next() === H1_REQUEST) {
      return true;
    }
  }
  return false;
};

/** Answers the current request with `body` under `names`/`values`; answers `respond`'s result. */
const answer = (conn: Http1Connection, status: i32, names: u8[][], values: u8[][], body: string): i32 => {
  const bytes: u8[] = ascii(body);
  const r: i32 = conn.respond(status, names, values, toI32(bytes.length));
  if (r === 0) {
    conn.write(bytes, ZERO, toI32(bytes.length));
    conn.end();
  }
  return r;
};

const GET: string = "GET /plaintext HTTP/1.1\r\nHost: a\r\n\r\n";
const BODY: string = "Hello, World!";

/** `n` copies of `text`. */
const times = (text: string, n: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < n; k++) {
    parts.push(text);
  }
  return parts.join("");
};

/** Answers `conn`'s next request and checks its bytes, and whether its head was copied. */
const check = (t: Suite, conn: Http1Connection, what: string, status: i32, ns: u8[][], vs: u8[][], text: string, reason: string, copied: boolean): void => {
  const before: i64 = conn.headCopies;
  const got: boolean = nextRequest(conn) && answer(conn, status, ns, vs, text) === 0;
  const expected: string = `${head(status, reason, ns, vs, toI32(text.length), "", conn.date.current())}${text}`;
  t.eqStr(what, got ? drained(conn) : "no answer", expected);
  t.ok(`${what}: ${copied ? "copied" : "written"}`, conn.headCopies === before + (copied ? 1 : 0));
};

/**
 * A fresh connection that answers `ns`/`vs` three times (written, kept, then
 * copied), then `status` with `vn`/`vv` and `text`: checked against that
 * kept head alone, so nothing an earlier variant left decides it.
 */
const against = (t: Suite, what: string, ns: u8[][], vs: u8[][], status: i32, vn: u8[][], vv: u8[][], text: string, reason: string, copied: boolean): void => {
  const conn = fed(times(GET, 4));
  check(t, conn, `${what}: the base head`, 200, ns, vs, BODY, "OK", false);
  check(t, conn, `${what}: the base head, kept`, 200, ns, vs, BODY, "OK", false);
  check(t, conn, `${what}: the base head, copied`, 200, ns, vs, BODY, "OK", true);
  check(t, conn, what, status, vn, vv, text, reason, copied);
};

export const main = (): i32 => {
  const t = new Suite("http1 head reuse");
  const names: u8[][] = fields(["Server", "Content-Type"]);
  const values: u8[][] = fields(["Nish", "text/plain"]);
  const body: string = BODY;
  const none: u8[][] = [];

  // A repeated head, pipelined: written twice, the second kept, copied after.
  const piped = fed(times(GET, 5));
  const date: u8[] = piped.date.current();
  const plain: string = head(200, "OK", names, values, 13, "", date);
  let results: i32 = 0;
  for (let k: i32 = 0; k < 5; k++) {
    if (nextRequest(piped)) {
      results += answer(piped, 200, names, values, body) === 0 ? 1 : 0;
    }
  }
  t.eqI32("five pipelined requests are answered", results, 5);
  t.eqStr("each with the head the writer writes, then its body", drained(piped), times(`${plain}${body}`, 5));
  t.ok("the first two heads are written and the three after them copied", piped.headCopies === 3);

  // Every input of the head, changed one at a time against a kept head, is a head written fresh.
  const three: u8[][] = fields(["Server", "Content-Type", "X-A"]);
  const threeValues: u8[][] = fields(["Nish", "text/plain", "1"]);
  against(t, "another status", names, values, 404, names, values, body, "Not Found", false);
  against(t, "another body length", names, values, 200, names, values, "Hello, World!!", "OK", false);
  against(t, "a value of the same length, changed", names, values, 200, names, fields(["Nish", "text/plaim"]), body, "OK", false);
  against(t, "a name of the same length in another case", names, values, 200, fields(["server", "Content-Type"]), values, body, "OK", false);
  against(t, "a field more", names, values, 200, three, threeValues, body, "OK", false);
  against(t, "a field fewer, its value never carried over", three, threeValues, 200, names, values, body, "OK", false);
  against(t, "the fields in another order", names, values, 200, fields(["Content-Type", "Server"]), fields(["text/plain", "Nish"]), body, "OK", false);
  against(t, "fresh arrays with the kept head's bytes", names, values, 200, fields(["Server", "Content-Type"]), fields(["Nish", "text/plain"]), body, "OK", true);
  // The same arrays, their bytes changed in place: compared by content, not identity.
  const live: u8[][] = fields(["Server", "Content-Type"]);
  const liveValues: u8[][] = fields(["Nish", "text/plain"]);
  const inPlace = fed(times(GET, 4));
  check(t, inPlace, "arrays answered in place", 200, live, liveValues, body, "OK", false);
  check(t, inPlace, "arrays answered in place, kept", 200, live, liveValues, body, "OK", false);
  check(t, inPlace, "arrays answered in place, copied", 200, live, liveValues, body, "OK", true);
  liveValues[1][9] = toU8(109);
  check(t, inPlace, "one byte changed in place in the same array", 200, live, liveValues, body, "OK", false);

  // Any status is kept like 200, and 200 after it is written.
  const statuses: i32[] = [201, 301, 302, 404, 500, 503];
  const reasons: string[] = ["Created", "Moved Permanently", "Found", "Not Found", "Internal Server Error", "Service Unavailable"];
  for (let k: i32 = 0; k < toI32(statuses.length); k++) {
    const conn = fed(times(GET, 4));
    const status: i32 = statuses[k];
    check(t, conn, `a ${status}`, status, names, values, body, reasons[k], false);
    check(t, conn, `a ${status}, kept`, status, names, values, body, reasons[k], false);
    check(t, conn, `a ${status}, copied`, status, names, values, body, reasons[k], true);
    check(t, conn, `a 200 after ${status}s`, 200, names, values, body, "OK", false);
  }

  // A second that turns is a new head; the next in that second is copied.
  const ticking = fed(times(GET, 5));
  nextRequest(ticking);
  answer(ticking, 200, names, values, body);
  nextRequest(ticking);
  answer(ticking, 200, names, values, body);
  const first: string = drained(ticking);
  ticking.date.pin(PINNED_MS + 1000);
  const later: u8[] = ticking.date.current();
  nextRequest(ticking);
  answer(ticking, 200, names, values, body);
  nextRequest(ticking);
  answer(ticking, 200, names, values, body);
  const laterHead: string = head(200, "OK", names, values, 13, "", later);
  t.eqStr("two answers in one second", first, times(`${plain}${body}`, 2));
  t.eqStr("two in the next carry the next second's Date", drained(ticking), times(`${laterHead}${body}`, 2));
  t.ok("the turn writes a head, the next is copied", ticking.headCopies === 1 && laterHead !== plain);
  // Within a second the pinned clock does not reformat: a later millisecond is the same head.
  ticking.date.pin(PINNED_MS + 1999);
  const current: u8[] = ticking.date.current();
  t.eqStr("a later millisecond of the same second reformats nothing", latin1(current, ZERO, toI32(current.length)), "Fri, 16 Oct 2026 08:11:55 GMT");
  check(t, ticking, "and its head is copied", 200, names, values, body, "OK", true);

  // Keep-alive, then close: the close is a head of its own.
  const closing = fed(`${GET}${GET}${GET}GET /plaintext HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n`);
  for (let k: i32 = 0; k < 4; k++) {
    nextRequest(closing);
    answer(closing, 200, names, values, body);
  }
  const closeHead: string = head(200, "OK", names, values, 13, "close", date);
  t.eqStr("three kept alive, then one with Connection: close", drained(closing), `${times(`${plain}${body}`, 3)}${closeHead}${body}`);
  t.ok("the third is copied, the close written", closing.headCopies === 1);

  // HTTP/1.0 keep-alive: its Connection field is part of the kept head.
  const old: string = "GET /plaintext HTTP/1.0\r\nConnection: keep-alive\r\n\r\n";
  const ten = fed(`${old}${old}${old}${GET}`);
  for (let k: i32 = 0; k < 4; k++) {
    nextRequest(ten);
    answer(ten, 200, names, values, body);
  }
  const aliveHead: string = head(200, "OK", names, values, 13, "keep-alive", date);
  t.eqStr("three HTTP/1.0 keep-alive answers, then an HTTP/1.1 one", drained(ten), `${times(`${aliveHead}${body}`, 3)}${plain}${body}`);
  t.ok("the third HTTP/1.0 head is copied, the HTTP/1.1 one written", ten.headCopies === 1);

  // HEAD: the same head, no body, and the GET after it still sends its body.
  const heading = fed(`${GET}${GET}HEAD /plaintext HTTP/1.1\r\nHost: a\r\n\r\n${GET}`);
  for (let k: i32 = 0; k < 4; k++) {
    nextRequest(heading);
    answer(heading, 200, names, values, body);
  }
  t.eqStr("GET, GET, HEAD, GET", drained(heading), `${plain}${body}${plain}${body}${plain}${plain}${body}`);
  t.ok("the HEAD's head and the GET's after it are copied", heading.headCopies === 2);
  // A HEAD whose length differs from the kept head's is written.
  const headLonger = fed(`${GET}${GET}${GET}HEAD /plaintext HTTP/1.1\r\nHost: a\r\n\r\n`);
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(headLonger);
    answer(headLonger, 200, names, values, body);
  }
  nextRequest(headLonger);
  answer(headLonger, 200, names, values, "Hello, World!!");
  const longer: string = head(200, "OK", names, values, 14, "", date);
  t.eqStr("three GETs, then a HEAD with another length", drained(headLonger), `${times(`${plain}${body}`, 3)}${longer}`);
  t.ok("the third GET's head is copied, the HEAD's written", headLonger.headCopies === 1);

  // 100 Continue is never kept, and does not end the kept head.
  const expecting = fed(`${GET}${GET}POST /p HTTP/1.1\r\nHost: a\r\nContent-Length: 0\r\nExpect: 100-continue\r\n\r\n`);
  for (let k: i32 = 0; k < 2; k++) {
    nextRequest(expecting);
    answer(expecting, 200, names, values, body);
  }
  nextRequest(expecting);
  const interim: i32 = expecting.respond(100, none, none, HTTP1_NO_BODY);
  answer(expecting, 200, names, values, body);
  t.eqStr("a 100 after two answers and before a third", drained(expecting), `${plain}${body}${plain}${body}HTTP/1.1 100 Continue\r\n\r\n${plain}${body}`);
  t.ok("the 100 is written and the answer after it copied", interim === 0 && expecting.headCopies === 1);

  // Chunked: kept like any framing; to HTTP/1.0 it is a close, written fresh.
  const chunked = fed(`${GET}${GET}${GET}GET / HTTP/1.0\r\n\r\n`);
  const chunkedHead: string = head(200, "OK", names, values, HTTP1_CHUNKED, "", date);
  const tenChunked: string = head(200, "OK", names, values, HTTP1_NO_BODY, "close", date);
  let chunkedOk: boolean = true;
  for (let k: i32 = 0; k < 4; k++) {
    nextRequest(chunked);
    chunkedOk = chunkedOk && chunked.respond(200, names, values, HTTP1_CHUNKED) === 0;
    chunked.end();
  }
  t.eqStr("three chunked answers, then one to HTTP/1.0", drained(chunked), `${times(`${chunkedHead}0\r\n\r\n`, 3)}${tenChunked}`);
  t.ok("the third chunked head is copied", chunkedOk && chunked.headCopies === 1);

  // A 204 or a 304 with no body: kept too.
  const bodiless: i32[] = [204, 304];
  const bodilessReasons: string[] = ["No Content", "Not Modified"];
  for (let s: i32 = 0; s < 2; s++) {
    const empty = fed(times(GET, 3));
    for (let k: i32 = 0; k < 3; k++) {
      nextRequest(empty);
      empty.respond(bodiless[s], names, values, HTTP1_NO_BODY);
      empty.end();
    }
    const noContent: string = head(bodiless[s], bodilessReasons[s], names, values, HTTP1_NO_BODY, "", date);
    t.eqStr(`three ${bodiless[s]}s`, drained(empty), times(noContent, 3));
    t.ok(`the third ${bodiless[s]} is copied`, empty.headCopies === 1);
  }

  // An error answer after a copied head carries none of its fields.
  const secret: u8[][] = fields(["X-Secret", "Content-Type"]);
  const secretValues: u8[][] = fields(["kept", "text/plain"]);
  const erring = fed(`${GET}${GET}${GET}GET /x HTTP/9.9\r\n\r\n`);
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(erring);
    answer(erring, 200, secret, secretValues, body);
  }
  t.ok("three answers before the error, the third copied", erring.headCopies === 1);
  for (let k: i32 = 0; k < 4; k++) {
    erring.next();
  }
  const kept: string = head(200, "OK", secret, secretValues, 13, "", date);
  const refusal: string = head(505, "HTTP Version Not Supported", none, none, 0, "close", date);
  const fresh = fed("GET /x HTTP/9.9\r\n\r\n");
  fresh.next();
  t.eqStr("a refused version is answered 505 and closed", drained(fresh), refusal);
  t.eqStr("an error after a copied head is that same 505", drained(erring), `${times(`${kept}${body}`, 3)}${refusal}`);

  // A request past a limit, likewise.
  const target: string = `GET /${times("a", 300)} HTTP/1.1\r\nHost: a\r\n\r\n`;
  const limited = fed(`${GET}${GET}${GET}${target}`);
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(limited);
    answer(limited, 200, names, values, body);
  }
  t.ok("three answers before the long target, the third copied", limited.headCopies === 1);
  for (let k: i32 = 0; k < 4; k++) {
    limited.next();
  }
  const tooLong: string = head(414, "URI Too Long", none, none, 0, "close", date);
  const alone = fed(target);
  alone.next();
  t.eqStr("a target past maxTarget is answered 414 and closed", drained(alone), tooLong);
  t.eqStr("and so after a copied head", drained(limited), `${times(`${plain}${body}`, 3)}${tooLong}`);

  // A field the writer refuses is refused even when its bytes line up with the kept head.
  const split = fed(times(GET, 8));
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(split);
    answer(split, 200, fields(["A", "B"]), fields(["1", "2"]), body);
  }
  drained(split);
  t.ok("a head of A and B is kept and copied", split.headCopies === 1);
  nextRequest(split);
  const dateText: string = latin1(date, ZERO, toI32(date.length));
  const shifted: i32 = split.respond(200, fields(["A: 1\r\nB", "Date"]), fields(["2", dateText]), 13);
  t.eqI32("a name spanning two kept lines is refused", shifted, H1_INVALID);
  const spanning: i32 = split.respond(200, fields(["A", "B"]), fields(["1", `2\r\nDate: ${dateText}\r\nContent-Length: 13`]), 13);
  t.eqI32("a last value spanning the kept Date and Content-Length is refused", spanning, H1_INVALID);
  for (let k: i32 = 0; k < 3; k++) {
    answer(split, 200, fields(["A"]), fields(["b: c"]), body);
    nextRequest(split);
  }
  drained(split);
  t.ok("then a head of A: b: c", split.headCopies === 2);
  t.eqI32("a name that takes in a colon of the kept value is refused", split.respond(200, fields(["A: b"]), fields(["c"]), 13), H1_INVALID);
  t.ok("nothing is queued by either", split.outputEnd === split.outputStart);

  // A head past the kept size is written every time.
  const big: string = times("v", 1100);
  const long = fed(times(GET, 2));
  for (let k: i32 = 0; k < 2; k++) {
    nextRequest(long);
    answer(long, 200, fields(["X-Big"]), fields([big]), body);
  }
  const bigHead: string = head(200, "OK", fields(["X-Big"]), fields([big]), 13, "", date);
  t.eqStr("a head of over 1 KiB twice", drained(long), times(`${bigHead}${body}`, 2));
  t.ok("written both times", long.headCopies === 0);

  // A long head, then short ones with its status and field count: the first
  // short one is the first kept, the second its first copy.
  const after = fed(times(GET, 4));
  nextRequest(after);
  answer(after, 200, fields(["X-Big"]), fields([big]), body);
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(after);
    answer(after, 200, fields(["X-Big"]), fields(["v"]), body);
  }
  const shortHead: string = head(200, "OK", fields(["X-Big"]), fields(["v"]), 13, "", date);
  t.eqStr("a head of over 1 KiB, then a short one with its field three times", drained(after), `${bigHead}${body}${times(`${shortHead}${body}`, 3)}`);
  t.ok("the short one is copied twice", after.headCopies === 2);

  // More fields than are kept: written every time.
  const many: string[] = [];
  const manyValues: string[] = [];
  for (let k: i32 = 0; k < 17; k++) {
    many.push(`X-F${k}`);
    manyValues.push(`${k}`);
  }
  const wide = fed(times(GET, 2));
  for (let k: i32 = 0; k < 2; k++) {
    nextRequest(wide);
    answer(wide, 200, fields(many), fields(manyValues), body);
  }
  const wideHead: string = head(200, "OK", fields(many), fields(manyValues), 13, "", date);
  t.eqStr("seventeen fields twice", drained(wide), times(`${wideHead}${body}`, 2));
  t.ok("written both times", wide.headCopies === 0);

  // Every length class of the kept-field compare (a byte at a time, four-,
  // eight- and sixteen-byte loads): a name and a value of each length kept,
  // then one byte changed at its start, middle and end, each against a
  // freshly kept head and written fresh.
  const lengths: i32[] = [1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33];
  for (const n of lengths) {
    const value: string = times("v", n);
    const name: string = times("n", n);
    const at: i32[] = n === 1 ? [0] : [0, n / 2, n - 1];
    for (const k of at) {
      const changedValue: string = `${times("v", k)}w${times("v", n - k - 1)}`;
      against(t, `a value of ${n} changed at ${k}`, fields(["X-L"]), fields([value]), 200, fields(["X-L"]), fields([changedValue]), body, "OK", false);
      const changedName: string = `${times("n", k)}m${times("n", n - k - 1)}`;
      against(t, `a name of ${n} changed at ${k}`, fields([name]), fields(["v"]), 200, fields([changedName]), fields(["v"]), body, "OK", false);
    }
  }

  // Exactly as many fields as are kept: written, kept, then copied.
  const sixteen: string[] = [];
  const sixteenValues: string[] = [];
  for (let k: i32 = 0; k < 16; k++) {
    sixteen.push(`X-F${k}`);
    sixteenValues.push(`${k}`);
  }
  const full = fed(times(GET, 3));
  check(t, full, "sixteen fields", 200, fields(sixteen), fields(sixteenValues), body, "OK", false);
  check(t, full, "sixteen fields, kept", 200, fields(sixteen), fields(sixteenValues), body, "OK", false);
  check(t, full, "sixteen fields, copied", 200, fields(sixteen), fields(sixteenValues), body, "OK", true);

  // Names and values under four bytes, the empty value among them, are
  // compared a byte at a time: kept and copied, then one byte changed.
  const short: u8[][] = fields(["A", "Bb", "Ccc", "D"]);
  const shortValues: u8[][] = fields(["", "1", "22", "333"]);
  const bytewise = fed(times(GET, 4));
  check(t, bytewise, "short fields", 200, short, shortValues, body, "OK", false);
  check(t, bytewise, "short fields, kept", 200, short, shortValues, body, "OK", false);
  check(t, bytewise, "short fields, copied", 200, short, shortValues, body, "OK", true);
  check(t, bytewise, "short fields, one byte changed", 200, short, fields(["", "1", "23", "333"]), body, "OK", false);

  // Four written heads in a row turn keeping off for the rest of the second:
  // a head that then repeats is written each time, until the Date turns.
  const streak = fed(times(GET, 12));
  check(t, streak, "a streak's base head", 200, names, values, body, "OK", false);
  check(t, streak, "a streak's base head, kept", 200, names, values, body, "OK", false);
  check(t, streak, "a streak's base head, copied", 200, names, values, body, "OK", true);
  const tags: string[] = ["Nisa", "Nisb", "Nisc", "Nisd"];
  for (let k: i32 = 0; k < 4; k++) {
    check(t, streak, `a miss in a row, ${k + 1}`, 200, names, fields([tags[k], "text/plain"]), body, "OK", false);
  }
  const lastTag: u8[][] = fields(["Nisd", "text/plain"]);
  check(t, streak, "the fourth miss repeated: off, so written", 200, names, lastTag, body, "OK", false);
  check(t, streak, "and again: written", 200, names, lastTag, body, "OK", false);
  check(t, streak, "the base head too: written", 200, names, values, body, "OK", false);
  t.ok("the streak copied nothing past its base", streak.headCopies === 1);
  streak.date.pin(PINNED_MS + 1000);
  check(t, streak, "the next second: on again, written", 200, names, values, body, "OK", false);
  check(t, streak, "the next second: kept, then copied", 200, names, values, body, "OK", true);

  // Heads of another shape each time turn it off the same way.
  const shapes = fed(times(GET, 9));
  const shapeStatus: i32[] = [200, 404, 200, 404];
  const shapeReason: string[] = ["OK", "Not Found", "OK", "Not Found"];
  for (let k: i32 = 0; k < 4; k++) {
    check(t, shapes, `another shape in a row, ${k + 1}`, shapeStatus[k], names, values, body, shapeReason[k], false);
  }
  for (let k: i32 = 0; k < 3; k++) {
    check(t, shapes, `then one head, off: written ${k + 1}`, 200, names, values, body, "OK", false);
  }
  shapes.date.pin(PINNED_MS + 1000);
  check(t, shapes, "the next second: written", 200, names, values, body, "OK", false);
  check(t, shapes, "the next second: copied", 200, names, values, body, "OK", true);

  // A copy ends a streak: three misses, a hit, three more, a hit, stay on.
  const broken = fed(times(GET, 11));
  check(t, broken, "a broken streak's base head", 200, names, values, body, "OK", false);
  check(t, broken, "a broken streak's base head, kept", 200, names, values, body, "OK", false);
  check(t, broken, "a broken streak's base head, copied", 200, names, values, body, "OK", true);
  for (let round: i32 = 0; round < 2; round++) {
    for (let k: i32 = 0; k < 3; k++) {
      check(t, broken, `round ${round + 1}, miss ${k + 1}`, 200, names, fields([tags[k], "text/plain"]), body, "OK", false);
    }
    check(t, broken, `round ${round + 1}, the third miss's head again`, 200, names, fields([tags[2], "text/plain"]), body, "OK", true);
  }

  // A restart turns keeping back on within the same second.
  streak.restart();
  const more: u8[] = ascii(times(GET, 7));
  streak.feed(more, ZERO, toI32(more.length));
  for (let k: i32 = 0; k < 4; k++) {
    check(t, streak, `a restarted streak, miss ${k + 1}`, 200, names, fields([tags[k], "text/plain"]), body, "OK", false);
  }
  streak.restart();
  streak.feed(more, ZERO, toI32(more.length));
  const copiesBefore: i64 = streak.headCopies;
  check(t, streak, "restarted while off: written", 200, names, values, body, "OK", false);
  check(t, streak, "restarted while off: kept", 200, names, values, body, "OK", false);
  check(t, streak, "restarted while off: copied", 200, names, values, body, "OK", true);
  t.ok("the restarted slot copied one", streak.headCopies === copiesBefore + 1);

  // A restarted slot keeps nothing of its last connection's head: the next
  // connection's first two heads are written, and only the third copied.
  const reused = fed(times(GET, 3));
  check(t, reused, "before the restart", 200, names, values, body, "OK", false);
  check(t, reused, "before the restart, kept", 200, names, values, body, "OK", false);
  check(t, reused, "before the restart, copied", 200, names, values, body, "OK", true);
  reused.restart();
  const again: u8[] = ascii(times(GET, 3));
  reused.feed(again, ZERO, toI32(again.length));
  check(t, reused, "after the restart", 200, names, values, body, "OK", false);
  check(t, reused, "after the restart, kept", 200, names, values, body, "OK", false);
  check(t, reused, "after the restart, copied", 200, names, values, body, "OK", true);

  // A head the kept one matches but that no longer fits the output: the copy
  // is refused and the write path holds the response (`H1_AGAIN`), queuing
  // nothing; once the output drains the same head is copied.
  // Any four-digit length: the head is as long as the one written for `fill`.
  const tightHead: string = head(200, "OK", names, values, 1000, "", date);
  // Room for the third head and body, and then one byte short of a fourth head.
  const fill: i32 = 8192 - 256 - 2 * toI32(tightHead.length) + 1;
  const fillBody: string = times("b", fill);
  const fullHead: string = head(200, "OK", names, values, fill, "", date);
  const tight = fed(times(GET, 4));
  check(t, tight, "a full-sized body", 200, names, values, fillBody, "OK", false);
  check(t, tight, "a full-sized body, kept", 200, names, values, fillBody, "OK", false);
  nextRequest(tight);
  t.eqI32("a full-sized body, copied", answer(tight, 200, names, values, fillBody), 0);
  t.ok("a full-sized body, copied: copied", tight.headCopies === 1);
  const queued: i32 = tight.outputEnd;
  nextRequest(tight);
  const bytes: u8[] = ascii(fillBody);
  t.eqI32("the same head with one byte too little room is held", tight.respond(200, names, values, fill), H1_AGAIN);
  t.ok("held: not copied", tight.headCopies === 1);
  t.ok("held: nothing queued", tight.outputEnd === queued);
  t.eqStr("held: the copied response is whole", drained(tight), `${fullHead}${fillBody}`);
  t.eqI32("then the program is asked to write", tight.next(), H1_WRITE);
  t.eqI32("the same head again", tight.respond(200, names, values, fill), 0);
  tight.write(bytes, ZERO, toI32(bytes.length));
  tight.end();
  t.ok("now copied", tight.headCopies === 2);
  t.eqStr("its bytes", drained(tight), `${fullHead}${fillBody}`);

  // A head copied across many responses, drained as it goes.
  const busy = fed(times(GET, 200));
  let same: i32 = 0;
  for (let k: i32 = 0; k < 200; k++) {
    if (nextRequest(busy) && answer(busy, 200, names, values, body) === 0 && drained(busy) === `${plain}${body}`) {
      same += 1;
    }
  }
  t.eqI32("two hundred answers, each byte for byte", same, 200);
  t.ok("two heads written, 198 copied", busy.headCopies === 198);

  return t.done();
};

