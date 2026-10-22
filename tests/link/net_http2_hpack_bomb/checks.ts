// `nish/net/http2` against the HTTP/2 Bomb, HPACK's worst case: one field of
// about 4 KB put in the dynamic table once, then named again and again by a
// one-octet index, each naming a field of 4,038 bytes against the header-list
// limit. A block of 16,000 indexes names 64 MB of fields; the decoder reads all
// of it, as it must to keep its table in step (RFC 9113 §10.5.1), and keeps
// none of it past the block (`docs/security/http2.md`, H2-1):
//
//   1. Under the limit, the field named three times reaches the program whole.
//   2. Named five times, over it, the stream is answered with a 431 and
//      nothing reaches the program.
//   3. Fifty bombs of 16,000 indexes, each a 431, move the arena not at all.
//   4. Fifty streams past SETTINGS_MAX_CONCURRENT_STREAMS, each naming the
//      field three times, are refused and move the arena not at all.
//   5. A hundred GETs answered move the arena not at all.
//
// Each measured batch follows one like it, so that the connection's own
// arrays have grown to what the batch needs, and is measured from one `rest`
// to the next, with every buffer given back.
//
// The checks live here so that `tests/link/net_http2_hpack_bomb_f64` runs every
// one again under `--number-mode f64`.
import { H2_FLAG_END_HEADERS, H2_FLAG_END_STREAM } from "nish/net/http2-frame";
import { H2_NEED_MORE, Http2Config } from "nish/net/http2";
import { Suite } from "nish/testing";
import { httpFieldBytes } from "nish/net/http-fields";
import { fromHex } from "../crypto_x509/hex";
import { Client, ZERO, postOf, textAt } from "../net_http2/peer";

/** The octets of the value the bomb puts in the table. */
const BOMB_VALUE: i32 = 4000;

/** How many indexes the bomb's block holds: under `maxHeaderBlock` and one frame. */
const BOMB_INDEXES: i32 = 16000;

/** How many blocks each measured round sends, after one that warms the decoder. */
const ROUNDS: i32 = 50;

/** Appends `bytes` to `out`. */
const append = (out: u8[], bytes: u8[]): void => {
  for (const b of bytes) {
    out.push(b);
  }
};

/**
 * A GET for `/` at example.com, then `x-bomb`: put in the table first when
 * `insert` (a literal with incremental indexing, `BOMB_VALUE` octets of `a`),
 * then named `indexes` times by index 62, the newest entry in the table.
 */
const bombBlock = (insert: boolean, indexes: i32): u8[] => {
  // :method GET, :scheme https and :path / from the static table; :authority by name, not indexed.
  const out: u8[] = fromHex("828784010b");
  append(out, httpFieldBytes("example.com"));
  if (insert) {
    // The name, 6 octets; the value's 4,000 as a 7-bit prefix integer: 127, then 3,873.
    append(out, fromHex("4006"));
    append(out, httpFieldBytes("x-bomb"));
    append(out, fromHex("7fa11e"));
    const a: u8 = 0x61;
    for (let k: i32 = 0; k < BOMB_VALUE; k++) {
      out.push(a);
    }
  }
  const named: u8 = 0xbe;
  for (let k: i32 = 0; k < indexes; k++) {
    out.push(named);
  }
  return out;
};

/** HEADERS carrying `block` whole, with END_HEADERS and END_STREAM. */
const sendBlock = (c: Client, stream: i32, block: u8[]): void => {
  c.wire.headersPart(stream, block, ZERO, toI32(block.length), H2_FLAG_END_HEADERS | H2_FLAG_END_STREAM);
};

/**
 * Feeds `bytes` and runs the connection until it needs more, answering each
 * request that holds the field once when `answer`, then gives the output and
 * the buffers back as a carrier does; answers how many events it gave.
 */
const feedAll = (c: Client, bytes: u8[], answer: boolean): i32 => {
  const noFields: u8[][] = [];
  const ok: i32 = 200;
  let events: i32 = 0;
  let at: i32 = 0;
  while (at < toI32(bytes.length)) {
    at = at + c.conn.feed(bytes, at, toI32(bytes.length) - at);
    let event: i32 = c.conn.next();
    while (event !== H2_NEED_MORE) {
      events = events + 1;
      if (answer && bombsIn(c) === toI32(1)) {
        c.conn.respond(c.conn.stream, ok, noFields, noFields, true);
      }
      event = c.conn.next();
    }
    c.conn.wantsWrite();
    c.conn.consume(c.conn.outputEnd - c.conn.outputStart);
  }
  c.conn.rest();
  return events;
};

/** How many of the program's fields are `x-bomb` with the bomb's value whole. */
const bombsIn = (c: Client): i32 => {
  let count: i32 = 0;
  const names: u8[][] = c.conn.fields.names;
  for (let k: i32 = 0; k < toI32(names.length); k++) {
    const value: u8[] = c.conn.fields.values[k];
    const whole: boolean = toI32(value.length) === BOMB_VALUE && value[BOMB_VALUE - 1] === 0x61;
    if (textAt(names[k], ZERO, toI32(names[k].length)) === "x-bomb" && whole) {
      count = count + 1;
    }
  }
  return count;
};

export const hpackBombChecks = (): i32 => {
  const t = new Suite("http2 hpack bomb");
  const noFields: u8[][] = [];
  const ok: i32 = 200;

  // A budget that the fifty 431s and refusals below do not reach (H2-4 charges each one).
  const config = new Http2Config();
  config.resetBudget = 1000;

  // --- 1. Under the limit --------------------------------------------------------------------------
  const c = new Client(config);
  c.open();
  sendBlock(c, toI32(1), bombBlock(true, toI32(2)));
  c.send();
  t.eqStr("a block that puts the field in the table and names it twice more is a request", c.takeEvents(), "request 1 GET / end");
  t.eqI32("and its three fields reach the program whole", bombsIn(c), toI32(3));
  c.conn.respond(toI32(1), ok, noFields, noFields, true);
  t.eqStr("which answers it", c.takeFrames(), "HEADERS 1 end :status=200");

  // --- 2. Over it ----------------------------------------------------------------------------------
  sendBlock(c, toI32(3), bombBlock(false, toI32(5)));
  c.send();
  t.eqStr("named five times, from the table alone, the list is past the limit and never reaches the program", c.takeEvents(), "");
  t.eqStr("it is answered with a 431", c.takeFrames(), "HEADERS 3 end :status=431");

  // --- 3. The bomb ---------------------------------------------------------------------------------
  let stream: i32 = 5;
  const warm: u8[] = bombBlock(false, BOMB_INDEXES);
  sendBlock(c, stream, warm);
  c.send();
  t.eqStr(
    `a block of ${BOMB_INDEXES} indexes, ${toI32(warm.length)} octets naming ${BOMB_INDEXES * (BOMB_VALUE + 38)} bytes of fields, is a 431 too`,
    `${c.takeEvents()}|${c.takeFrames()}`,
    "|HEADERS 5 end :status=431"
  );
  stream = stream + 2;
  let bombEvents: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(c, stream, warm);
    stream = stream + 2;
  }
  bombEvents = bombEvents + feedAll(c, c.wire.take(), false);
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(c, stream, warm);
    stream = stream + 2;
  }
  const bombs: u8[] = c.wire.take();
  const bombBefore: i64 = Arena.used();
  bombEvents = bombEvents + feedAll(c, bombs, false);
  const bombMoved: i64 = Arena.used() - bombBefore;
  t.eqI32(`${ROUNDS * toI32(2)} more reach the program not at all`, bombEvents, ZERO);
  t.ok(`and the last ${ROUNDS} move the arena not at all (${bombMoved} bytes)`, bombMoved === toI64(0));
  sendBlock(c, stream, bombBlock(false, toI32(1)));
  c.send();
  t.eqStr("the table still holds the field: one more block naming it once is a request", c.takeEvents(), `request ${stream} GET / end`);
  t.eqI32("with the field whole", bombsIn(c), toI32(1));

  // --- 4. Refused streams --------------------------------------------------------------------------
  const one = new Http2Config();
  one.maxStreams = 1;
  one.resetBudget = 1000;
  const r = new Client(one);
  r.open();
  r.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  sendBlock(r, toI32(3), bombBlock(true, toI32(2)));
  r.send();
  t.eqStr(
    "past SETTINGS_MAX_CONCURRENT_STREAMS, a block naming the field three times is refused, never reaching the program",
    `${r.takeEvents()}|${r.takeFrames()}`,
    "request 1 POST /|RST_STREAM 3 7"
  );
  const thrice: u8[] = bombBlock(false, toI32(3));
  let refusedStream: i32 = 5;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(r, refusedStream, thrice);
    refusedStream = refusedStream + 2;
  }
  let refusedEvents: i32 = feedAll(r, r.wire.take(), false);
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(r, refusedStream, thrice);
    refusedStream = refusedStream + 2;
  }
  const refused: u8[] = r.wire.take();
  const refusedBefore: i64 = Arena.used();
  refusedEvents = refusedEvents + feedAll(r, refused, false);
  const refusedMoved: i64 = Arena.used() - refusedBefore;
  t.eqI32(`${ROUNDS * toI32(2)} more are refused, reaching the program not at all`, refusedEvents, ZERO);
  t.ok(`and the last ${ROUNDS} move the arena not at all (${refusedMoved} bytes)`, refusedMoved === toI64(0));

  // --- 5. Requests in a loop -----------------------------------------------------------------------
  const g = new Client(config);
  g.open();
  sendBlock(g, toI32(1), bombBlock(true, toI32(0)));
  g.send();
  g.takeEvents();
  g.conn.respond(toI32(1), ok, noFields, noFields, true);
  g.takeFrames();
  const get: u8[] = bombBlock(false, toI32(1));
  let getStream: i32 = 3;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(g, getStream, get);
    getStream = getStream + 2;
  }
  let answered: i32 = feedAll(g, g.wire.take(), true);
  for (let k: i32 = 0; k < ROUNDS; k++) {
    sendBlock(g, getStream, get);
    getStream = getStream + 2;
  }
  const gets: u8[] = g.wire.take();
  const getsBefore: i64 = Arena.used();
  answered = answered + feedAll(g, gets, true);
  const getsMoved: i64 = Arena.used() - getsBefore;
  t.eqI32(`${ROUNDS * toI32(2)} GETs, each naming the field once, are each a request`, answered, ROUNDS * toI32(2));
  t.ok(`and the last ${ROUNDS}, each answered, move the arena not at all (${getsMoved} bytes)`, getsMoved === toI64(0));

  return t.done();
};
