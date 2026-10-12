// The Nish side of bench/json-compare: three workloads over one JSON document,
// each a loop whose input changes on every iteration and whose output is
// folded into a printed checksum that every comparator must print too.
//
//   main <workload> <file> <iterations> <at>
//
//   tokenize     every token of the document read with `nish/json-tokenizer`,
//                every key and string copied out with `stringInto`, every
//                number read with `numberF64`
//   typed        citm_catalog's `performances` decoded with `nish/json-typed`
//                into a fresh `Catalog` every iteration, as the comparators
//                decode into a fresh value
//   typed-reuse  the same, into one `Catalog` reused from one iteration to the
//                next, as nish/json-typed lets a server do; its own row
//   serialize    the same classes, decoded once, written back minified with
//                `jsonEncode` into one reused buffer
//
// Before each tokenize or typed iteration the byte at offset `at` (a digit
// that bench/json-compare/run.mjs picks) is set to the digit `iteration % 10`;
// before each serialize iteration one performance's `start` moves on by one.
// The checksum folds are run.mjs's header's, byte for byte, in every program.
// The first line printed is the checksum, the second the time the clock saw.
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

/** Bytes `out[0 .. n)`, each folded in. */
const foldBytes = (h: u64, out: u8[], n: i32): u64 => {
  let acc: u64 = h
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    acc = fold(acc, toU64(out[i]))
  }
  return acc
}

/** A string field: 0 for null, else its length in bytes plus one, then every byte. */
const foldString = (h: u64, s: string | null): u64 => {
  if (s === null) {
    return fold(h, toU64(0))
  }
  let acc: u64 = fold(h, toU64(s.length + 1))
  for (let i: i32 = 0; i < toI32(s.length); i += 1) {
    acc = fold(acc, toU64(toI32(s.charCodeAt(i))))
  }
  return acc
}

/** One document's tokens: the fold of kinds and strings, the token count, and the sum of the numbers. */
class TokenSums {
  h: u64 = 0
  tokens: i32 = 0
  numbers: f64 = 0
}

/**
 * Every token of `doc`. A key or string folds in its decoded length and its
 * last byte (0 when empty), or with `full` every byte after the length: the
 * timed loop folds the first, the untimed pass after it the second.
 */
const tokenizeOnce = (tok: JsonTokenizer, doc: u8[], out: u8[], sums: TokenSums, full: boolean): void => {
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
      h = fold(h, toU64(n))
      if (full) {
        h = foldBytes(h, out, n)
      } else {
        h = fold(h, toU64(n > 0 && n <= toI32(out.length) ? toI32(out[n - 1]) : 0))
      }
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
    h = foldString(foldString(h, p.logo), p.name)
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
    h = foldString(h, p.seatMapImage)
    h = foldString(fold(h, toU64(p.start)), p.venueCode)
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
    tokenizeOnce(tok, doc, out, sums, false)
    h = fold(h, sums.h)
    numbers += sums.numbers
  }
  const elapsed: i64 = monotonicNanos() - t0
  tokenizeOnce(tok, doc, out, sums, true)
  console.log(`tokenize ${h} ${sums.tokens} ${numbers} ${sums.h}`)
  return elapsed
}

/** Typed decode, into a fresh `Catalog` per iteration or into one reused. */
const runTyped = (doc: u8[], iterations: i32, at: i32, reuse: boolean): i64 => {
  const d = new JsonDecoder(doc, 0, toI32(doc.length), new JsonLimits())
  let c = new Catalog()
  let h: u64 = 0
  const t0: i64 = monotonicNanos()
  for (let r: i32 = 0; r < iterations; r += 1) {
    mutate(doc, at, r)
    if (!reuse) {
      c = new Catalog()
    }
    decodeInto(d, doc, c)
    h = fold(h, foldCatalog(c))
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`typed ${h} ${c.performances.length}`)
  return elapsed
}

/** Only the encode is timed: every byte of every output is folded in outside the clock. */
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
  let elapsed: i64 = 0
  for (let r: i32 = 0; r < iterations; r += 1) {
    const p: Performance = c.performances[r % count]
    p.start = p.start + toI64(1)
    const t0: i64 = monotonicNanos()
    w.reset(out, 0)
    jsonEncode(w, c)
    elapsed += monotonicNanos() - t0
    if (!w.complete()) {
      panic(`serialize: the writer failed with code ${w.failed}`)
    }
    h = fold(h, foldBytes(toU64(0), out, w.written()))
  }
  console.log(`serialize ${h} ${w.written()}`)
  return elapsed
}

export const main = (): number => {
  if (process.argv.length < 5) {
    console.error("usage: main <tokenize|typed|typed-reuse|serialize> <file> <iterations> <at>")
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
  } else if (workload === "typed" || workload === "typed-reuse") {
    elapsed = runTyped(doc, iterations, at, workload === "typed-reuse")
  } else if (workload === "serialize") {
    elapsed = runSerialize(doc, iterations)
  } else {
    console.error(`unknown workload ${workload}`)
    return 2
  }
  console.log(`ns ${elapsed}`)
  return 0
}
