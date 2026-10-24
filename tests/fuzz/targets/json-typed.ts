/**
 * Fuzz target: typed JSON (std/json-typed.ts), decoding into three shapes
 * and encoding back.
 *
 * Byte 0 picks the mode and the rest is the text, the window `[1, n)` of
 * `data`. The mode's low two bits pick the shape (nested arrays of a class,
 * optional and `| null` fields with renamed keys, or maps of maps), bit 2
 * sets `ignoreUnknown`, and bit 3 sets tight `JsonLimits`. A value that
 * decodes is encoded, and the text it encodes to must decode again into a
 * fresh value that encodes to the same text. A refusal is `jsonDecode`'s
 * negative code; a panic, or a round trip that disagrees, is a crash.
 *
 * `maxMapKeys` is held to 64: the colliding-keys cost behind it is JSON-13
 * (docs/security/json.md), open and owned elsewhere, and a long run would
 * otherwise rediscover it as a timeout rather than find anything new.
 */
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_DECODE_OK, JsonDecoder, JsonNumber, jsonDecode, jsonEncode } from "nish/json-typed"

enum Level {
  Low = 0,
  High = 7,
}

class Point {
  x: i32 = 0
  y: i64 = 0
  w: f64 = 0
}

class Row {
  points: Point[]

  constructor() {
    this.points = []
  }
}

class Grid {
  name: string = ""
  rows: Row[]
  flags: boolean[]
  ids: u64[]
  level: Level = Level.Low

  constructor() {
    this.rows = []
    this.flags = []
    this.ids = []
  }
}

class Account {
  static readonly json = { rename: { userId: "user_id" }, optional: ["nick", "home", "scores"] }
  userId: u32 = 0
  tags: string[]
  nick: string | null = null
  home: Point | null = null
  raw: JsonNumber
  scores: i32[] | null = null

  constructor() {
    this.tags = []
    this.raw = new JsonNumber()
  }
}

class Index {
  counts: Map<string, i32>
  points: Map<string, Point>
  groups: Map<string, Map<string, string | null>>
  lists: Map<string, u64[]> | null = null

  constructor() {
    this.counts = new Map<string, i32>()
    this.points = new Map<string, Point>()
    this.groups = new Map<string, Map<string, string | null>>()
  }
}

const decoder = (src: u8[], off: i32, len: i32, mode: i32): JsonDecoder => {
  const limits: JsonLimits = new JsonLimits()
  if ((mode & 8) !== 0) {
    limits.maxDepth = 6
    limits.maxStringBytes = 16
    limits.maxNumberBytes = 8
    limits.maxTotalBytes = 128
  }
  const d: JsonDecoder = new JsonDecoder(src, off, len, limits)
  d.ignoreUnknown = (mode & 4) !== 0
  d.maxMapKeys = 64
  return d
}

/** A writer over `size` bytes, after encoding `value` into it. */
const encode = <T>(value: T, size: i32): JsonWriter => {
  const w: JsonWriter = new JsonWriter(new Array<u8>(size), 0)
  jsonEncode(w, value)
  return w
}

/** The round trip of a decoded value: encoded, decoded into `fresh`, encoded again. */
const roundTrip = <T>(value: T, fresh: T, size: i32, mode: i32): void => {
  const w: JsonWriter = encode(value, size)
  if (w.failed !== 0) {
    panic(`json-typed: a decoded value did not encode (${w.failed})`)
  }
  const text: string = w.text()
  // The text is the encoder's, with no unknown keys, so it decodes with the
  // default limits whatever the mode's were.
  const d: JsonDecoder = decoder(w.buf, 0, w.end, mode & 4)
  const code: i32 = jsonDecode(d, fresh)
  if (code !== JSON_DECODE_OK) {
    panic(`json-typed: the encoded text does not decode (${code}): ${text}`)
  }
  const again: JsonWriter = encode(fresh, size)
  if (again.failed !== 0 || again.text() !== text) {
    panic(`json-typed: the round trip is not stable: ${text}`)
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n === 0) {
    return
  }
  const mode: i32 = toI32(data[0])
  const d: JsonDecoder = decoder(data, 1, n - 1, mode)
  // Encoded text is at most a few times the input: every byte of a string
  // can become a six-byte escape, and a number is written as read.
  const size: i32 = 8 * n + 256
  const shape: i32 = mode & 3
  if (shape === 0) {
    const g: Grid = new Grid()
    if (jsonDecode(d, g) === JSON_DECODE_OK) {
      roundTrip(g, new Grid(), size, mode)
    }
  } else if (shape === 1) {
    const a: Account = new Account()
    if (jsonDecode(d, a) === JSON_DECODE_OK) {
      roundTrip(a, new Account(), size, mode)
    }
  } else {
    const x: Index = new Index()
    if (jsonDecode(d, x) === JSON_DECODE_OK) {
      roundTrip(x, new Index(), size, mode)
    }
  }
}
