// `Http1Connection.respond` keeps a final head it has written twice running
// (the same status, framing, `Connection` and number of fields) and copies it
// when the next is the same: the same fields too, in the same second. These checks drive one connection with
// no socket and read every response byte for byte against
// `http1WriteResponseHead` called directly, so a copied head is shown to be
// the head the writer would have written, and a head that differs in any
// input (a status, a field's name or value, its order, a length, the
// `Connection` the request asked for, the second) to be written fresh.
// `headCopies` tells the two apart.
import { HTTP1_CHUNKED, HTTP1_NO_BODY, http1WriteResponseHead } from "nish/net/http1-codec";
import { H1_INVALID, H1_REQUEST, Http1Config, Http1Connection } from "nish/net/http1-server";
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

export const main = (): i32 => {
  const t = new Suite("http1 head reuse");
  const names: u8[][] = fields(["Server", "Content-Type"]);
  const values: u8[][] = fields(["Nish", "text/plain"]);
  const body: string = "Hello, World!";

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

  // Every input of the head, changed one at a time, is a head written fresh.
  const changes = fed(times(GET, 13));
  check(t, changes, "the first head", 200, names, values, body, "OK", false);
  check(t, changes, "the same head again, kept", 200, names, values, body, "OK", false);
  check(t, changes, "and once more", 200, names, values, body, "OK", true);
  check(t, changes, "another status", 404, names, values, body, "Not Found", false);
  check(t, changes, "back to 200", 200, names, values, body, "OK", false);
  check(t, changes, "another body length", 200, names, values, "Hello, World!!", "OK", false);
  check(t, changes, "a value of the same length, changed", 200, names, fields(["Nish", "text/plaim"]), body, "OK", false);
  check(t, changes, "a name of the same length in another case", 200, fields(["server", "Content-Type"]), fields(["Nish", "text/plaim"]), body, "OK", false);
  check(t, changes, "a field more", 200, fields(["server", "Content-Type", "X-A"]), fields(["Nish", "text/plaim", "1"]), body, "OK", false);
  check(t, changes, "a field fewer, its value never carried over", 200, fields(["server", "Content-Type"]), fields(["Nish", "text/plaim"]), body, "OK", false);
  check(t, changes, "the fields in another order", 200, fields(["Content-Type", "server"]), fields(["text/plaim", "Nish"]), body, "OK", false);
  // The same arrays, their bytes changed in place: compared by content, not identity.
  const live: u8[][] = fields(["Content-Type", "server"]);
  const liveValues: u8[][] = fields(["text/plaim", "Nish"]);
  check(t, changes, "fresh arrays with the kept head's bytes", 200, live, liveValues, body, "OK", true);
  liveValues[0][9] = toU8(110);
  check(t, changes, "one byte changed in place in the same array", 200, live, liveValues, body, "OK", false);

  // A second that turns is a new head; the next in that second is copied.
  const ticking = fed(times(GET, 4));
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
  t.ok("a later millisecond of the same second reformats nothing", latin1(ticking.date.current(), ZERO, 29) === latin1(later, ZERO, 29));

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

  // 100 Continue is never kept, and does not end the kept head.
  const expecting = fed(`${GET}${GET}POST /p HTTP/1.1\r\nHost: a\r\nContent-Length: 0\r\nExpect: 100-continue\r\n\r\n`);
  for (let k: i32 = 0; k < 2; k++) {
    nextRequest(expecting);
    answer(expecting, 200, names, values, body);
  }
  nextRequest(expecting);
  const none: u8[][] = [];
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

  // A 204 with no body: kept too.
  const empty = fed(times(GET, 3));
  for (let k: i32 = 0; k < 3; k++) {
    nextRequest(empty);
    empty.respond(204, names, values, HTTP1_NO_BODY);
    empty.end();
  }
  const noContent: string = head(204, "No Content", names, values, HTTP1_NO_BODY, "", date);
  t.eqStr("three 204s", drained(empty), times(noContent, 3));
  t.ok("the third 204 is copied", empty.headCopies === 1);

  // An error answer after a kept head carries none of its fields.
  const erring = fed(`${GET}GET /x HTTP/9.9\r\n\r\n`);
  nextRequest(erring);
  answer(erring, 200, fields(["X-Secret", "Content-Type"]), fields(["kept", "text/plain"]), body);
  for (let k: i32 = 0; k < 4; k++) {
    erring.next();
  }
  const kept: string = head(200, "OK", fields(["X-Secret", "Content-Type"]), fields(["kept", "text/plain"]), 13, "", date);
  const fresh = fed("GET /x HTTP/9.9\r\n\r\n");
  fresh.next();
  const refusal: string = drained(fresh);
  t.ok("a refused request is answered", refusal.startsWith("HTTP/1.1 ") && refusal.length > 0);
  t.eqStr("an error after a kept head is the error a fresh connection answers", drained(erring), `${kept}${body}${refusal}`);

  // A request past a limit, likewise.
  const target: string = `GET /${times("a", 300)} HTTP/1.1\r\nHost: a\r\n\r\n`;
  const limited = fed(`${GET}${target}`);
  nextRequest(limited);
  answer(limited, 200, names, values, body);
  for (let k: i32 = 0; k < 4; k++) {
    limited.next();
  }
  const alone = fed(target);
  alone.next();
  const tooLong: string = drained(alone);
  t.ok("a target past maxTarget is answered 414", tooLong.startsWith("HTTP/1.1 414 "));
  t.eqStr("and so after a kept head", drained(limited), `${plain}${body}${tooLong}`);

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
  // eight- and sixteen-byte loads): a name and a value of each length, then
  // one byte changed at its start, middle and end, each written fresh.
  const lengths: i32[] = [1, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33];
  for (const n of lengths) {
    const kept: string = times("v", n);
    const sizes = fed(times(GET, 6));
    const at: i32[] = n === 1 ? [0] : [0, n / 2, n - 1];
    check(t, sizes, `a value of ${n}, first`, 200, fields(["X-L"]), fields([kept]), body, "OK", false);
    check(t, sizes, `a value of ${n}, kept`, 200, fields(["X-L"]), fields([kept]), body, "OK", false);
    check(t, sizes, `a value of ${n}, again`, 200, fields(["X-L"]), fields([kept]), body, "OK", true);
    for (const k of at) {
      const changed: string = `${times("v", k)}w${times("v", n - k - 1)}`;
      check(t, sizes, `a value of ${n} changed at ${k}`, 200, fields(["X-L"]), fields([changed]), body, "OK", false);
    }
    const named = fed(times(GET, 6));
    const name: string = times("n", n);
    check(t, named, `a name of ${n}, first`, 200, fields([name]), fields(["v"]), body, "OK", false);
    check(t, named, `a name of ${n}, kept`, 200, fields([name]), fields(["v"]), body, "OK", false);
    check(t, named, `a name of ${n}, again`, 200, fields([name]), fields(["v"]), body, "OK", true);
    for (const k of at) {
      const changed: string = `${times("n", k)}m${times("n", n - k - 1)}`;
      check(t, named, `a name of ${n} changed at ${k}`, 200, fields([changed]), fields(["v"]), body, "OK", false);
    }
  }

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

