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
//   6. A field whose name is about 4 KB, named by index from a literal three
//      octets long, 5,000 times a block, as a literal without indexing and as
//      one never indexed: each block a 431, fifty of each kind moving the arena
//      not at all and copying nothing out of the table, which still names the
//      field whole afterwards. As a literal with incremental indexing, two
//      octets long, the table copies the name out and back in each time: twice
//      in a block is within the block's copy budget and is a request, and
//      5,000 times ends the connection with ENHANCE_YOUR_CALM.
//   7. A program that holds a request's fields past the next header block —
//      a 431, a refused stream or another request — never reads that block's
//      octets in them: the fields are empty, or the newer request's whole.
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
import { HttpFields, httpFieldBytes } from "nish/net/http-fields";
import { fromHex } from "../crypto_x509/hex";
import { Client, ZERO, getOf, postOf, textAt } from "../net_http2/peer";

/** The octets of the value the bomb puts in the table. */
const BOMB_VALUE: i32 = 4000;

/** How many indexes the bomb's block holds: under `maxHeaderBlock` and one frame. */
const BOMB_INDEXES: i32 = 16000;

/** The octets of the name the literal bomb puts in the table. */
const LONG_NAME: i32 = 4000;

/** How many literals the literal bomb's block holds: three octets each at most, one frame. */
const LITERAL_INDEXES: i32 = 5000;

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

/**
 * A GET for `/` at example.com, then, when `insert`, a field whose name is
 * `LONG_NAME` octets of `a` and whose value is empty, put in the table; then
 * `count` literals of `kind`'s representation naming it by index 62 with an
 * empty value, or one indexed field naming it whole when `kind` is empty.
 */
const literalBlock = (insert: boolean, kind: string, count: i32): u8[] => {
  const out: u8[] = fromHex("828784010b");
  append(out, httpFieldBytes("example.com"));
  if (insert) {
    // A new name of 4,000 octets, as a 7-bit prefix integer: 127, then 3,873; then an empty value.
    append(out, fromHex("407fa11e"));
    const a: u8 = 0x61;
    for (let k: i32 = 0; k < LONG_NAME; k++) {
      out.push(a);
    }
    append(out, fromHex("00"));
  }
  if (kind === "") {
    append(out, fromHex("be"));
    return out;
  }
  // Index 62 in a 6-bit prefix is one octet; in a 4-bit one it is 15, then 47.
  const literal: u8[] = fromHex(kind === "incremental" ? "7e00" : kind === "without" ? "0f2f00" : "1f2f00");
  for (let k: i32 = 0; k < count; k++) {
    append(out, literal);
  }
  return out;
};

/** How many of the program's fields have the long name whole and an empty value. */
const longNamesIn = (c: Client): i32 => {
  let count: i32 = 0;
  const names: u8[][] = c.conn.fields.names;
  for (let k: i32 = 0; k < toI32(names.length); k++) {
    const name: u8[] = names[k];
    const whole: boolean = toI32(name.length) === LONG_NAME && name[LONG_NAME - 1] === 0x61;
    if (whole && toI32(c.conn.fields.values[k].length) === 0) {
      count = count + 1;
    }
  }
  return count;
};

/** `fields`' method, path and authority, and how many regular fields it holds, between bars. */
const heldText = (fields: HttpFields): string =>
  `${textAt(fields.method, ZERO, toI32(fields.method.length))}|${textAt(fields.path, ZERO, toI32(fields.path.length))}|${textAt(fields.authority, ZERO, toI32(fields.authority.length))}|${toI32(fields.names.length)}`;

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

  // --- 6. Literals naming a long name ---------------------------------------------------------------
  const l = new Client(config);
  l.open();
  sendBlock(l, toI32(1), literalBlock(true, "", toI32(0)));
  l.send();
  t.eqStr("a block that puts a name of 4,000 octets in the table and names it once is a request", l.takeEvents(), "request 1 GET / end");
  t.eqI32("with both fields whole", longNamesIn(l), toI32(2));
  l.conn.respond(toI32(1), ok, noFields, noFields, true);
  l.takeFrames();
  let literalStream: i32 = 3;
  const kinds: string[] = ["without", "never"];
  for (const kind of kinds) {
    const block: u8[] = literalBlock(false, kind, LITERAL_INDEXES);
    const copiedBefore: i64 = l.conn.decoder.tableCopied;
    sendBlock(l, literalStream, block);
    l.send();
    t.eqStr(
      `${LITERAL_INDEXES} literals ${kind}, ${toI32(block.length)} octets naming ${LITERAL_INDEXES * (LONG_NAME + 32)} bytes of fields by index, are a 431`,
      `${l.takeEvents()}|${l.takeFrames()}`,
      `|HEADERS ${literalStream} end :status=431`
    );
    literalStream = literalStream + 2;
    for (let k: i32 = 0; k < ROUNDS; k++) {
      sendBlock(l, literalStream, block);
      literalStream = literalStream + 2;
    }
    let literalEvents: i32 = feedAll(l, l.wire.take(), false);
    for (let k: i32 = 0; k < ROUNDS; k++) {
      sendBlock(l, literalStream, block);
      literalStream = literalStream + 2;
    }
    const literals: u8[] = l.wire.take();
    const literalsBefore: i64 = Arena.used();
    literalEvents = literalEvents + feedAll(l, literals, false);
    const literalsMoved: i64 = Arena.used() - literalsBefore;
    const literalsCopied: i64 = l.conn.decoder.tableCopied - copiedBefore;
    t.eqI32(`${ROUNDS * toI32(2)} more reach the program not at all`, literalEvents, ZERO);
    t.ok(`and the last ${ROUNDS} move the arena not at all (${literalsMoved} bytes)`, literalsMoved === toI64(0));
    // The GET's four fields are 177 bytes of the 16,384 the list limit allows, so 4 of the 4,032-byte
    // literals fit under it; each of those copies its 4,000-octet name for the program, the rest nothing.
    const blocks: i64 = toI64(ROUNDS * toI32(2) + toI32(1));
    const keptPerBlock: i64 = toI64(4) * toI64(LONG_NAME);
    t.ok(
      `and all ${blocks} copy out of the table only the names under the list limit, 4 x 4,000 octets a block (${literalsCopied})`,
      literalsCopied === blocks * keptPerBlock && keptPerBlock <= toI64(config.maxHeaderListSize)
    );
  }
  sendBlock(l, literalStream, literalBlock(false, "", toI32(0)));
  l.send();
  t.eqStr("the table still names the field: one more block naming it once is a request", l.takeEvents(), `request ${literalStream} GET / end`);
  t.eqI32("with the field whole", longNamesIn(l), toI32(1));
  l.conn.respond(literalStream, ok, noFields, noFields, true);
  l.takeFrames();
  literalStream = literalStream + 2;
  const twiceBefore: i64 = l.conn.decoder.tableCopied;
  sendBlock(l, literalStream, literalBlock(false, "incremental", toI32(2)));
  l.send();
  t.eqStr(
    "two literals with incremental indexing naming it, each copying the name out of the table and back in, are a request",
    l.takeEvents(),
    `request ${literalStream} GET / end`
  );
  t.eqI32("with both fields whole", longNamesIn(l), toI32(2));
  const twice: i64 = l.conn.decoder.tableCopied - twiceBefore;
  // The budget charges each literal its name out of the table and its field back in, before copying.
  const charged: i64 = toI64(2) * (toI64(LONG_NAME) + toI64(LONG_NAME));
  t.ok(
    `copying ${twice} octets, as measured, the ${charged} the budget charges, within its 4 x 4,096`,
    twice === charged && charged <= toI64(4) * toI64(4096)
  );
  l.conn.respond(literalStream, ok, noFields, noFields, true);
  l.takeFrames();
  const lastStream: i32 = literalStream;
  literalStream = literalStream + 2;
  const incremental: u8[] = literalBlock(false, "incremental", LITERAL_INDEXES);
  sendBlock(l, literalStream, incremental);
  l.send();
  t.eqStr(
    `${LITERAL_INDEXES} of them, ${toI32(incremental.length)} octets, pass the budget and end the connection with ENHANCE_YOUR_CALM`,
    `${l.takeEvents()}|${l.takeFrames()}`,
    `error 11|GOAWAY ${lastStream} 11`
  );

  // --- 7. Fields held past the next block ----------------------------------------------------------
  const a = new Client(config);
  a.open();
  a.wire.headers(toI32(1), getOf("/one"), H2_FLAG_END_STREAM);
  a.send();
  t.eqStr("stream 1's request", a.takeEvents(), "request 1 GET /one end");
  const held: HttpFields = a.conn.fields;
  const copied: string = textAt(held.path, ZERO, toI32(held.path.length));
  a.conn.respond(toI32(1), ok, noFields, noFields, true);
  a.takeFrames();
  sendBlock(a, toI32(3), bombBlock(true, toI32(5)));
  a.send();
  t.eqStr("then stream 3's block, past the header-list limit", `${a.takeEvents()}|${a.takeFrames()}`, "|HEADERS 3 end :status=431");
  t.eqStr("leaves stream 1's held fields empty, never stream 3's", heldText(held), "|||0");
  a.wire.headers(toI32(5), getOf("/five"), H2_FLAG_END_STREAM);
  a.send();
  t.eqStr("stream 5's request", a.takeEvents(), "request 5 GET /five end");
  t.eqStr("leaves them stream 5's whole", heldText(held), "GET|/five|example.com|0");
  t.eqStr("while the copy taken of stream 1's path is still its own", copied, "/one");
  const h = new Client(one);
  h.open();
  h.wire.headers(toI32(1), postOf("/one", toI32(9)), ZERO);
  h.send();
  t.eqStr("stream 1's request, left open", h.takeEvents(), "request 1 POST /one");
  const refusedHeld: HttpFields = h.conn.fields;
  h.wire.headers(toI32(3), getOf("/three"), H2_FLAG_END_STREAM);
  h.send();
  t.eqStr("then stream 3, past SETTINGS_MAX_CONCURRENT_STREAMS", `${h.takeEvents()}|${h.takeFrames()}`, "|RST_STREAM 3 7");
  t.eqStr("is refused, leaving stream 1's held fields empty, never stream 3's", heldText(refusedHeld), "|||0");

  return t.done();
};
