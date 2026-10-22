// MadeYouReset (CVE-2025-8671, #805): a client that cannot afford to send
// RST_STREAM itself makes the server send it, on a stream it has just
// opened, by breaking a rule the server answers with a stream error. Every
// such reset, and every refused stream, is charged to the same `resetBudget`
// as the client's own resets: one trigger per case, each run once past the
// budget, which must end in GOAWAY ENHANCE_YOUR_CALM, and once up to it,
// which must leave the connection answering.
import { H2_CANCEL, H2_FLAG_END_STREAM, http2WriteHeader } from "nish/net/http2-frame";
import { Http2Config } from "nish/net/http2";
import { Suite } from "nish/testing";
import { toHex } from "../crypto_x509/hex";
import { Client, ZERO, getOf, postOf } from "../net_http2/peer";

/** The budget every case runs under. */
const BUDGET: i32 = 2;

/** The triggers, by the number `provoke` takes. */
const triggers = (): string[] => [
  "a WINDOW_UPDATE of zero on the stream",
  "a PRIORITY that makes the stream depend on itself",
  "a WINDOW_UPDATE that takes the stream's window past 2^31 - 1",
  "DATA past the stream's window",
  "trailers without END_STREAM",
  "a header list past SETTINGS_MAX_HEADER_LIST_SIZE, answered with a 431",
  "a malformed request",
  "a HEADERS that makes its own stream depend on itself",
  "a stream past SETTINGS_MAX_CONCURRENT_STREAMS, refused",
];

/** The trigger that needs a stream already open, so that the next is refused. */
const REFUSED: i32 = 8;

/** The frame header for a payload of `length` bytes, as hex, then the payload `hex` spells. */
const frameHex = (length: i32, type: i32, flags: i32, stream: i32, hex: string): string => {
  const out: u8[] = new Array<u8>(9 + length);
  http2WriteHeader(out, ZERO, length, type, flags, stream);
  return `${toHex(out).substring(0, 18)}${hex}`;
};

/** A field value past the header-list cap below. */
const LONG: string = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789";

/** A connection past both prefaces, small enough for every trigger, with `budget` resets; stream 1 is held open for REFUSED. */
const opened = (kind: i32, budget: i32): Client => {
  const config = new Http2Config();
  config.resetBudget = budget;
  config.initialWindowSize = 100;
  config.maxHeaderListSize = 240;
  if (kind === REFUSED) {
    config.maxStreams = 1;
  }
  const c = new Client(config);
  c.open();
  if (kind === REFUSED) {
    c.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
    c.send();
    c.takeEvents();
  }
  return c;
};

/** The first stream a case provokes on. */
const firstOf = (kind: i32): i32 => (kind === REFUSED ? toI32(3) : toI32(1));

/** Opens stream `id` with a valid request and provokes the server into resetting it the way trigger `kind` does. */
const provoke = (c: Client, kind: i32, id: i32): void => {
  switch (kind) {
    case 0:
      c.wire.headers(id, postOf("/", toI32(9)), ZERO);
      c.wire.hex(frameHex(toI32(4), toI32(8), ZERO, id, "00000000"));
      break;
    case 1:
      c.wire.headers(id, postOf("/", toI32(9)), ZERO);
      // `priority` refuses to write this; a stream identifier below 10 is one hex digit.
      c.wire.hex(frameHex(toI32(5), toI32(2), ZERO, id, `0000000${id}10`));
      break;
    case 2:
      c.wire.headers(id, postOf("/", toI32(9)), ZERO);
      c.wire.windowUpdate(id, toI32(2147483647));
      break;
    case 3:
      c.wire.headers(id, postOf("/", toI32(500)), ZERO);
      c.wire.dataN(id, toI32(101), ZERO);
      break;
    case 4:
      c.wire.headers(id, postOf("/", toI32(2)), ZERO);
      c.wire.data(id, "ab", ZERO);
      c.wire.headers(id, ["x-t", "1"], ZERO);
      break;
    case 5:
      c.wire.headers(id, [":method", "GET", ":scheme", "https", ":path", "/", "x-t", LONG], H2_FLAG_END_STREAM);
      break;
    case 6:
      c.wire.headers(id, [":method", "GET", ":scheme", "https", ":path", "/", "Accept", "*/*"], H2_FLAG_END_STREAM);
      break;
    case 7:
      c.wire.headersWithPriority(id, getOf("/"), id);
      break;
    default:
      c.wire.headers(id, getOf("/"), H2_FLAG_END_STREAM);
      break;
  }
};

/** No fields. */
const nothing = (): u8[][] => [];

/** Whether what the client holds goes through with no GOAWAY, and a PING after it is still answered. */
const lives = (c: Client): boolean => {
  c.send();
  const calm: boolean = c.takeEvents().indexOf("error") < 0 && c.takeFrames().indexOf("GOAWAY") < 0;
  c.wire.ping("00000000000000aa");
  c.send();
  return calm && c.takeFrames() === "PING ack 00000000000000aa";
};

export const main = (): i32 => {
  const t = new Suite("http2 reset budget");

  const names: string[] = triggers();
  for (let kind: i32 = 0; kind < toI32(names.length); kind++) {
    const first: i32 = firstOf(kind);
    const over = opened(kind, BUDGET);
    let last: i32 = first;
    for (let k: i32 = 0; k <= BUDGET; k++) {
      last = first + 2 * k;
      provoke(over, kind, last);
    }
    over.send();
    const events: string = over.takeEvents();
    const frames: string = over.takeFrames();
    t.ok(
      `${names[kind]}, once more than resetBudget allows: ENHANCE_YOUR_CALM`,
      events.indexOf("error 11") === toI32(events.length) - 8 && frames.indexOf(`GOAWAY ${last} 11`) >= 0
    );
    const under = opened(kind, BUDGET);
    for (let k: i32 = 0; k < BUDGET; k++) {
      provoke(under, kind, first + 2 * k);
    }
    t.ok(`${names[kind]}, as often as it allows: the connection lives`, lives(under));
  }

  // The budget is one pool: the client's own resets and the ones it provokes count together.
  const mixed = opened(toI32(0), BUDGET);
  mixed.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  mixed.wire.rst(toI32(1), H2_CANCEL);
  provoke(mixed, toI32(0), toI32(3));
  provoke(mixed, toI32(0), toI32(5));
  mixed.send();
  t.eqStr(
    "a reset the client sends and two it provokes, against a budget of two: ENHANCE_YOUR_CALM",
    `${mixed.takeEvents()} | ${mixed.takeFrames()}`,
    "request 1 POST /; reset 1 8 peer; request 3 POST /; reset 3 1 rule; request 5 POST /; error 11 | RST_STREAM 3 1; RST_STREAM 5 1; GOAWAY 5 11"
  );

  // A stream the server finishes earns a provoked reset back, as it does a client's.
  const earned = opened(toI32(0), toI32(1));
  for (let k: i32 = 0; k < 5; k++) {
    earned.wire.headers(4 * k + 1, getOf("/"), H2_FLAG_END_STREAM);
    earned.send();
    earned.conn.respond(4 * k + 1, toI32(200), nothing(), nothing(), true);
    provoke(earned, toI32(0), 4 * k + 3);
  }
  t.ok("a stream the server finishes earns the budget back: a budget of one takes a provoked reset after every answer", lives(earned));

  // What the program resets itself is its own choice, and costs the client nothing.
  const own = opened(toI32(0), toI32(1));
  for (let k: i32 = 0; k < 5; k++) {
    const id: i32 = 2 * k + 1;
    own.wire.headers(id, postOf("/", toI32(9)), ZERO);
    own.send();
    own.conn.reset(id, H2_CANCEL);
  }
  t.ok("streams the program resets itself are not charged to the client", lives(own));
  return t.done();
};
