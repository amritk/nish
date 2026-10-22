// `nish/net/hpack`'s dynamic table, the byte store `HpackDecoder` keeps its
// entries in (`docs/security/http2.md`, H2-1), against a model of RFC 7541 §4:
//
//   1. Sixty fields added one block at a time to a table of 300 bytes, some
//      with a new name and some naming an entry already there, evict the
//      oldest and shift the evicted prefix out of the store; after every block
//      each entry still held reads back by index, name and value, octet for
//      octet as the model has it.
//   2. A literal with incremental indexing whose name is the entry its own
//      addition evicts (§4.4) decodes with that name, and the table then holds
//      the new entry.
//   3. One whose entry is larger than the table empties it, and still decodes
//      with the name it named.
//
// The checks live here so that `tests/link/net_http2_hpack_table_f64` runs every
// one again under `--number-mode f64`.
import { HPACK_OK, HpackDecoder, HpackHuffman, hpackEncodeInteger, hpackEncodeString } from "nish/net/hpack";
import { Suite } from "nish/testing";
import { httpFieldBytes } from "nish/net/http-fields";
import { ZERO, textAt } from "../net_http2/peer";

/** The table's maximum size: a handful of entries, so that eviction and the store's compaction both happen often. */
const TABLE: i32 = 300;

/** How many fields part 1 adds. */
const ADDS: i32 = 60;

/** A header-list limit no block here reaches. */
const LIST: i32 = 65536;

/** `n` copies of the character `c`. */
const repeat = (c: string, n: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < n; k++) {
    parts.push(c);
  }
  return parts.join("");
};

/** All of `bytes` as text. */
const text = (bytes: u8[]): string => textAt(bytes, ZERO, toI32(bytes.length));

/** A literal with incremental indexing and a new name. */
const literalNew = (h: HpackHuffman, out: u8[], name: string, value: string): void => {
  hpackEncodeInteger(out, 0x40, 6, ZERO);
  hpackEncodeString(h, out, httpFieldBytes(name), false);
  hpackEncodeString(h, out, httpFieldBytes(value), false);
};

/** A literal with incremental indexing whose name is the entry at `index`. */
const literalNamed = (h: HpackHuffman, out: u8[], index: i32, value: string): void => {
  hpackEncodeInteger(out, 0x40, 6, index);
  hpackEncodeString(h, out, httpFieldBytes(value), false);
};

/** Decodes `block` whole and answers its fields as `name: value` lines, or the error. */
const decodeAll = (d: HpackDecoder, block: u8[]): string => {
  const result: i32 = d.decode(block, ZERO, toI32(block.length));
  if (result !== HPACK_OK) {
    return `error ${result}`;
  }
  const lines: string[] = [];
  for (let k: i32 = 0; k < toI32(d.names.length); k++) {
    lines.push(`${text(d.names[k])}: ${text(d.values[k])}`);
  }
  return lines.join("\n");
};

/** The model's entries, as names and values beside each other: the live ones from `oldest` on, newest last; and their size. */
class Model {
  names: string[];
  values: string[];
  oldest: i32;
  size: i32;

  constructor() {
    this.names = [];
    this.values = [];
    this.oldest = 0;
    this.size = 0;
  }

  /** How many entries it holds. */
  count(): i32 {
    return toI32(this.names.length) - this.oldest;
  }

  /** Entry `i`, 1 being the newest, as `name: value`. */
  field(i: i32): string {
    const k: i32 = toI32(this.names.length) - i;
    return `${this.names[k]}: ${this.values[k]}`;
  }

  /** Adds a field as the newest entry, evicting the oldest first to make room (§4.4). */
  add(name: string, value: string): void {
    const cost: i32 = toI32(name.length) + toI32(value.length) + 32;
    while (this.size + cost > TABLE && this.count() > 0) {
      this.size = this.size - (toI32(this.names[this.oldest].length) + toI32(this.values[this.oldest].length) + 32);
      this.oldest = this.oldest + 1;
    }
    if (cost <= TABLE) {
      this.names.push(name);
      this.values.push(value);
      this.size = this.size + cost;
    }
  }
}

export const hpackTableChecks = (): i32 => {
  const t = new Suite("http2 hpack table");
  const h = new HpackHuffman();

  // --- 1. Eviction and compaction ------------------------------------------------------------------
  const d = new HpackDecoder(TABLE, LIST);
  const model = new Model();
  let mismatches: i32 = 0;
  let checked: i32 = 0;
  let entriesShifted: i32 = 0;
  let bytesShifted: i32 = 0;
  let largestStore: i32 = 0;
  for (let k: i32 = 0; k < ADDS; k++) {
    const value: string = repeat(k % 2 === 0 ? "v" : "w", (k * 37) % 61);
    const block: u8[] = [];
    let name: string = `name-${k}`;
    const held: i32 = model.count();
    if (k % 3 === 2 && held > 0) {
      // Every third field names the oldest entry, the one its own addition is likeliest to evict.
      name = model.names[model.oldest];
      literalNamed(h, block, 61 + held, value);
    } else {
      literalNew(h, block, name, value);
    }
    const firstBefore: i32 = d.table.first;
    const startBefore: i32 = d.table.count() > 0 ? d.table.nameStart(d.table.count()) : ZERO;
    const decoded: string = decodeAll(d, block);
    model.add(name, value);
    if (decoded !== `${name}: ${value}`) {
      mismatches = mismatches + 1;
    }
    if (d.table.count() > 0 && firstBefore > 0 && d.table.first === 0) {
      entriesShifted = entriesShifted + 1;
    }
    if (d.table.count() > 0 && startBefore > 0 && d.table.nameStart(d.table.count()) === 0) {
      bytesShifted = bytesShifted + 1;
    }
    if (toI32(d.table.bytes.length) > largestStore) {
      largestStore = toI32(d.table.bytes.length);
    }
    if (d.table.count() !== model.count() || d.table.size !== model.size) {
      mismatches = mismatches + 1;
    }
    // Every entry still held, newest first, read back by index.
    const n: i32 = model.count();
    for (let i: i32 = 1; i <= n && i <= d.table.count(); i++) {
      const read: u8[] = [];
      hpackEncodeInteger(read, 0x80, 7, 61 + i);
      checked = checked + 1;
      if (decodeAll(d, read) !== model.field(i)) {
        mismatches = mismatches + 1;
      }
    }
  }
  t.eqI32(`${ADDS} fields added to a table of ${TABLE} bytes, ${checked} entries read back by index after each, match the model`, mismatches, ZERO);
  t.ok(`the evicted entries were shifted out while entries survived (${entriesShifted} times)`, entriesShifted > 0);
  t.ok(`and the evicted octets shifted out of the store while entries survived (${bytesShifted} times)`, bytesShifted > 0);
  t.ok(`which never held more than three times the table's size (${largestStore} octets)`, largestStore <= TABLE * 3);

  // --- 2. A name its own addition evicts -----------------------------------------------------------
  const e = new HpackDecoder(100, LIST);
  const put: u8[] = [];
  literalNew(h, put, "abc", repeat("x", 50));
  t.eqStr("an entry of 85 bytes in a table of 100", decodeAll(e, put), `abc: ${repeat("x", 50)}`);
  const again: u8[] = [];
  literalNamed(h, again, 62, repeat("y", 20));
  t.eqStr("a literal naming it, whose 55 bytes evict it, decodes with its name", decodeAll(e, again), `abc: ${repeat("y", 20)}`);
  const read: u8[] = [];
  hpackEncodeInteger(read, 0x80, 7, 62);
  t.eqStr("and the table holds the new entry alone", `${e.table.count()}|${decodeAll(e, read)}`, `1|abc: ${repeat("y", 20)}`);

  // --- 3. An entry larger than the table -----------------------------------------------------------
  const large: u8[] = [];
  literalNamed(h, large, 62, repeat("z", 80));
  t.eqStr("a literal naming it whose 115 bytes pass the table's 100 decodes with its name", decodeAll(e, large), `abc: ${repeat("z", 80)}`);
  t.eqI32("and empties the table", e.table.count(), ZERO);

  return t.done();
};
