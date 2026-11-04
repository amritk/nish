// `Http1Connection` alone, with no socket: what its output buffer and its
// input room do across requests, checked by reading its fields. Run by
// `main.ts` after `checks.ts`, and only there: the `--number-mode f64` twin
// runs `checks.ts` alone.
import { HTTP1_NO_BODY } from "nish/net/http1-codec";
import { H1_END, H1_REQUEST, Http1Connection, Http1OutputPool } from "nish/net/http1-server";
import { Suite } from "nish/testing";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { testConfig } from "./checks";

const PINNED_MS: i64 = 1792138314000;

/** A connection under `testConfig` fed `text` whole. */
const fed = (text: string): Http1Connection => {
  const conn = new Http1Connection(testConfig());
  conn.date.pin(PINNED_MS);
  const bytes: u8[] = ascii(text);
  conn.feed(bytes, ZERO, toI32(bytes.length));
  return conn;
};

export const connectionChecks = (): i32 => {
  const t = new Suite("http1 connection");
  const get: string = "GET /hello HTTP/1.1\r\nHost: a\r\n\r\n";
  const none: u8[][] = [];
  const size: i32 = testConfig().outputSize;

  // The output buffer: borrowed to write a response, given back once sent.
  const borrowing = fed(`${get}${get}`);
  const lent = new Http1OutputPool(size);
  borrowing.pool = lent;
  t.ok("a pooled connection reads a request holding no output buffer", borrowing.next() === H1_REQUEST && borrowing.output.length === 0 && lent.made === 0);
  borrowing.respond(204, none, none, HTTP1_NO_BODY);
  borrowing.end();
  t.ok("its response borrows one", borrowing.wantsWrite() && borrowing.output.length === size && lent.made === 1);
  borrowing.release();
  t.ok("which it keeps while bytes wait to be sent", borrowing.output.length === size && lent.free.length === 0);
  borrowing.consume(borrowing.outputEnd - borrowing.outputStart);
  borrowing.release();
  t.ok("and gives back once they are", borrowing.output.length === 0 && lent.free.length === 1);
  borrowing.release();
  t.ok("a release holding nothing gives nothing", lent.free.length === 1);
  t.eqI32("the request ends", borrowing.next(), H1_END);
  t.eqI32("the next request is read", borrowing.next(), H1_REQUEST);
  borrowing.respond(204, none, none, HTTP1_NO_BODY);
  t.ok("and its response borrows the same buffer again, making none", borrowing.output.length === size && lent.made === 1 && lent.free.length === 0);

  // A connection that keeps its own buffer makes it once and keeps it.
  const keeping = fed(`${get}${get}`);
  keeping.next();
  keeping.respond(204, none, none, HTTP1_NO_BODY);
  keeping.end();
  const own: u8[] = keeping.output;
  keeping.consume(keeping.outputEnd - keeping.outputStart);
  keeping.release();
  keeping.next();
  keeping.next();
  keeping.respond(204, none, none, HTTP1_NO_BODY);
  t.ok("a connection with no pool keeps its own buffer across requests", own.length === size && keeping.output === own);

  // The input room: a request's is the buffer cap less what is unread; an
  // upgraded slot's is the message cap less what its decoder holds.
  const half: string = "GET /hello HTTP/1.1\r\nHo";
  const reading = fed(half);
  t.eqI32("a request's room is bufferLimit less its unread bytes", reading.inputRoom(), reading.bufferLimit - toI32(half.length));
  const upgrade = fed(
    "GET /ws HTTP/1.1\r\nHost: a\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
  );
  upgrade.next();
  upgrade.acceptWebSocket("");
  upgrade.next();
  upgrade.next();
  const limit: i32 = testConfig().maxMessage + 14;
  t.ok("an upgraded slot's room is its message cap before its first frame", upgrade.isWebSocket() && upgrade.inputRoom() === limit);
  const frame: u8[] = [0x81, 0x85, 0, 0, 0, 0, 0x68];
  upgrade.feed(frame, ZERO, toI32(frame.length));
  t.eqI32("and a frame's unread bytes count against it", upgrade.inputRoom(), limit - 7);
  return t.done();
};
