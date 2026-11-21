// `Http1Connection.lendParsed` lends the parser's head to a reader that may
// hold it past the connection (`nish/net/serve`'s task reads its request in
// place). A lent head is the reader's as well as the parser's, so `park` must
// not give it to the connection's head pool: a pooled head is handed to the
// next connection that unparks, and a restart then hands the same buffer to
// the reader, two owners of one head. These checks drive a pooled connection
// with no socket: they park it while its head is lent, restart it, and read
// which buffer went where, by identity.
import { HTTP1_NO_BODY } from "nish/net/http1-codec";
import { H1_NEED_MORE, H1_REQUEST, Http1Config, Http1Connection, Http1OutputPool } from "nish/net/http1-server";
import { Suite } from "nish/testing";

const ZERO: i32 = 0;
const GET: string = "GET /plaintext HTTP/1.1\r\nHost: a\r\n\r\n";

/** `text` as bytes, one per UTF-16 unit: the checks spell only ASCII. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** Whether `pool` holds `buf` itself, not a buffer with its bytes. */
const pooled = (pool: Http1OutputPool, buf: u8[]): boolean => {
  for (let k: i32 = 0; k < toI32(pool.free.length); k++) {
    if (pool.free[k] === buf) {
      return true;
    }
  }
  return false;
};

/** A connection with its own input and head pools, fed one GET and moved to it: null when no request came. */
const opened = (heads: Http1OutputPool): Http1Connection | null => {
  const c = new Http1Config();
  c.maxTarget = 256;
  c.maxHeaderBytes = 1024;
  c.outputSize = 8192;
  const conn = new Http1Connection(c);
  conn.inputs = new Http1OutputPool(4096);
  conn.heads = heads;
  const bytes: u8[] = ascii(GET);
  conn.feed(bytes, ZERO, toI32(bytes.length));
  for (let k: i32 = 0; k < 4; k++) {
    if (conn.next() === H1_REQUEST) {
      return conn;
    }
  }
  return null;
};

/** Answers `conn`'s request with an empty 204 and takes its output, so the connection rests. */
const answered = (conn: Http1Connection): boolean => {
  const none: u8[][] = [];
  if (conn.respond(204, none, none, HTTP1_NO_BODY) !== 0) {
    return false;
  }
  conn.end();
  for (let k: i32 = 0; k < 4; k++) {
    if (conn.next() === H1_NEED_MORE) {
      break;
    }
  }
  conn.consume(conn.outputEnd - conn.outputStart);
  return true;
};

export const main = (): i32 => {
  const t = new Suite("http1 lend and park");

  // Closed while lent: the head stays out of the pool, and the reader keeps it.
  const heads = new Http1OutputPool(1024);
  const conn = opened(heads);
  if (conn === null) {
    t.fail("a request", "none came");
    return t.done();
  }
  const lent: u8[] = conn.parser.head;
  t.ok("the parser has a head", toI32(lent.length) > 0);
  const spare: u8[] = new Array<u8>(0);
  conn.lendParsed(spare, new Array<i32>(0));
  t.ok("the lent request is answered", answered(conn));
  conn.park();
  t.ok("park keeps a lent head out of the pool", !pooled(heads, lent));
  t.ok("park leaves a lent head with the parser", conn.parser.head === lent);
  conn.restart();
  t.ok("a restart gives the parser the spare", conn.parser.head !== lent);
  t.ok("after the restart the lent head is still in no pool", !pooled(heads, lent));
  t.ok("the loan reads as ended by the restart", !conn.unlendParsed());

  // Answered while lent and not closed: ending the loan parks the head.
  const heads2 = new Http1OutputPool(1024);
  const kept = opened(heads2);
  if (kept === null) {
    t.fail("a second request", "none came");
    return t.done();
  }
  const lent2: u8[] = kept.parser.head;
  kept.lendParsed(new Array<u8>(0), new Array<i32>(0));
  t.ok("the second lent request is answered", answered(kept));
  kept.park();
  t.ok("a resting connection keeps its lent head", !pooled(heads2, lent2));
  t.ok("the loan reads as held", kept.unlendParsed());
  t.ok("ending the loan parks the head", pooled(heads2, lent2));
  return t.done();
};
