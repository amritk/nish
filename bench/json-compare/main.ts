// The Nish side of bench/json-compare: three workloads over one JSON document,
// each a loop whose input changes on every iteration and whose output is
// folded into a printed checksum that every comparator must print too.
//
//   main <workload> <file> <iterations> <at>
//
//   tokenize   every token of the document read with `nish/json-tokenizer`,
//              every key and string copied out with `stringInto`, every
//              number read with `numberF64`
//   typed      citm_catalog's `performances` decoded with `nish/json-typed`
//              into the classes below, reusing them from one iteration to
//              the next
//   serialize  the same classes, decoded once, written back minified with
//              `jsonEncode` into one reused buffer
//
// Before each tokenize or typed iteration the byte at offset `at` (a digit
// that bench/json-compare/run.mjs picks) is set to the digit `iteration % 10`;
// before each serialize iteration one performance's `start` moves on by one.
// The checksum folds are run.mjs's header's, byte for byte, in every program.
// The first line printed is the checksum, the second the loop's own time.
import { JsonWriter } from "nish/json"
import {
  JSON_TOK_END,
  JSON_TOK_KEY,
  JSON_TOK_NUMBER,
  JSON_TOK_STRING,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"

class Price {
  amount: i64 = 0
  audienceSubCategoryId: i64 = 0
  seatCategoryId: i64 = 0
}

class Area {
  areaId: i64 = 0
  blockIds: i64[]

  constructor() {
    this.blockIds = []
  }
}

class SeatCategory {
  areas: Area[]
  seatCategoryId: i64 = 0

  constructor() {
    this.areas = []
  }
}

class Performance {
  eventId: i64 = 0
  id: i64 = 0
  logo: string | null = null
  name: string | null = null
  prices: Price[]
  seatCategories: SeatCategory[]
  seatMapImage: string | null = null
  start: i64 = 0
  venueCode: string = ""

  constructor() {
    this.prices = []
    this.seatCategories = []
  }
}

class Catalog {
  performances: Performance[]

  constructor() {
    this.performances = []
  }
}

/** `h * 31 + v`, wrapping, the one fold every checksum is made of. */
const fold = (h: u64, v: u64): u64 => h * toU64(31) + v

/** A string's fold: its length in bytes, then its last byte (0 when empty). */
const foldText = (h: u64, len: i32, last: i32): u64 => fold(fold(h, toU64(len)), toU64(last))

/** A `string | null` field's fold: 0 for null, else the length plus one. */
const foldOptional = (h: u64, s: string | null): u64 =>
  s === null ? fold(h, toU64(0)) : fold(h, toU64(s.length + 1))

/** One document's tokens: the fold of kinds and strings, the token count, and the sum of the numbers. */
class TokenSums {
  h: u64 = 0
  tokens: i32 = 0
  numbers: f64 = 0
}

const tokenizeOnce = (tok: JsonTokenizer, doc: u8[], out: u8[], sums: TokenSums): void => {
  tok.reset(doc, 0, toI32(doc.length))
  let h: u64 = 0
  let tokens: i32 = 0
  let numbers: f64 = 0
  let k: i32 = tok.next()
  while (k > 0) {
    h = fold(h, toU64(k))
    tokens += 1
    if (k === JSON_TOK_KEY || k === JSON_TOK_STRING) {
      const n: i32 = tok.stringInto(out, 0)
      h = foldText(h, n, n > 0 && n <= toI32(out.length) ? toI32(out[n - 1]) : 0)
    } else if (k === JSON_TOK_NUMBER) {
      numbers += tok.numberF64()
    }
    k = tok.next()
  }
  if (k !== JSON_TOK_END) {
    panic(`tokenize: the document is not JSON (code ${k})`)
  }
  sums.h = h
  sums.tokens = tokens
  sums.numbers = numbers
}

/** Every field of every performance, in declaration order. */
const foldCatalog = (c: Catalog): u64 => {
  let h: u64 = 0
  for (const p of c.performances) {
    h = fold(fold(h, toU64(p.eventId)), toU64(p.id))
    h = foldOptional(foldOptional(h, p.logo), p.name)
    h = fold(h, toU64(p.prices.length))
    for (const price of p.prices) {
      h = fold(
        fold(fold(h, toU64(price.amount)), toU64(price.audienceSubCategoryId)),
        toU64(price.seatCategoryId)
      )
    }
    h = fold(h, toU64(p.seatCategories.length))
    for (const sc of p.seatCategories) {
      h = fold(h, toU64(sc.areas.length))
      for (const area of sc.areas) {
        h = fold(fold(h, toU64(area.areaId)), toU64(area.blockIds.length))
        for (const b of area.blockIds) {
          h = fold(h, toU64(b))
        }
      }
      h = fold(h, toU64(sc.seatCategoryId))
    }
    h = foldOptional(h, p.seatMapImage)
    h = fold(fold(h, toU64(p.start)), toU64(p.venueCode.length))
  }
  return h
}

const decodeInto = (d: JsonDecoder, doc: u8[], c: Catalog): void => {
  d.reset(doc, 0, toI32(doc.length))
  d.ignoreUnknown = true
  const code: i32 = jsonDecode(d, c)
  if (code !== 0) {
    panic(`typed: decoding failed with code ${code} at byte ${d.errorAt}`)
  }
}

/** The digit `r % 10` written at `at`, when `at` names a byte of `doc`. */
const mutate = (doc: u8[], at: i32, r: i32): void => {
  if (at >= 0 && at < toI32(doc.length)) {
    doc[at] = toU8(48 + (r % 10))
  }
}

const runTokenize = (doc: u8[], iterations: i32, at: i32): i64 => {
  const out = new Array<u8>(toI32(doc.length))
  const tok = new JsonTokenizer(doc, 0, toI32(doc.length), new JsonLimits())
  const sums = new TokenSums()
  let h: u64 = 0
  let numbers: f64 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    mutate(doc, at, r)
    tokenizeOnce(tok, doc, out, sums)
    h = fold(h, sums.h)
    numbers += sums.numbers
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`tokenize ${h} ${sums.tokens} ${numbers}`)
  return elapsed
}

const runTyped = (doc: u8[], iterations: i32, at: i32): i64 => {
  const d = new JsonDecoder(doc, 0, toI32(doc.length), new JsonLimits())
  const c = new Catalog()
  let h: u64 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    mutate(doc, at, r)
    decodeInto(d, doc, c)
    h = fold(h, foldCatalog(c))
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`typed ${h} ${c.performances.length}`)
  return elapsed
}

const runSerialize = (doc: u8[], iterations: i32): i64 => {
  const d = new JsonDecoder(doc, 0, toI32(doc.length), new JsonLimits())
  const c = new Catalog()
  decodeInto(d, doc, c)
  const count: i32 = toI32(c.performances.length)
  if (count === 0) {
    panic("serialize: the document has no performances")
  }
  const out = new Array<u8>(toI32(doc.length) * 2 + 64)
  const w = new JsonWriter(out, 0)
  let h: u64 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    const p: Performance = c.performances[r % count]
    p.start = p.start + toI64(1)
    w.reset(out, 0)
    jsonEncode(w, c)
    if (!w.complete()) {
      panic(`serialize: the writer failed with code ${w.failed}`)
    }
    const len: i32 = w.written()
    h = fold(fold(h, toU64(len)), toU64(out[r % len]))
  }
  const elapsed: i64 = monotonicNanos() - t0
  const len: i32 = w.written()
  let bytes: u64 = 0
  for (let i: i32 = 0; i < len && i < toI32(out.length); i += 1) {
    bytes = fold(bytes, toU64(out[i]))
  }
  console.log(`serialize ${h} ${len} ${bytes}`)
  return elapsed
}

export const main = (): number => {
  if (process.argv.length < 5) {
    console.error("usage: main <tokenize|typed|serialize> <file> <iterations> <at>")
    return 2
  }
  const workload: string = process.argv[1]
  const read: u8[] | null = readFileBytesSync(process.argv[2])
  if (read === null) {
    console.error(`cannot read ${process.argv[2]}`)
    return 1
  }
  const doc: u8[] = read
  const iterations: i32 = toI32(parseInt(process.argv[3]))
  const at: i32 = toI32(parseInt(process.argv[4]))
  let elapsed: i64 = -1
  if (workload === "tokenize") {
    elapsed = runTokenize(doc, iterations, at)
  } else if (workload === "typed") {
    elapsed = runTyped(doc, iterations, at)
  } else if (workload === "serialize") {
    elapsed = runSerialize(doc, iterations)
  } else {
    console.error(`unknown workload ${workload}`)
    return 2
  }
  console.log(`ns ${elapsed}`)
  return 0
}
