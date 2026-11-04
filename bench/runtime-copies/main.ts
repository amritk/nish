// The copy and bounds-check shapes the stdlib benches spend their runtime on,
// each alone in a timed loop, so a change to how the compiler or runtime emits
// one shows up outside the noise band a whole request path drowns it in.
// bench/runtime-copies/README.md says where each shape was found.
//
//   main <case> <iterations>
//
// prints `checksum xxxxxxxx` on stdout and the timed loop's nanoseconds as
// `ns N` on stderr (bench/crypto/lib/gen.ts's contract). The checksum folds
// every byte each case produces, so a build that skips work fails it.
//
// The cases:
//   chars         a base64url-shaped encoder: one `String.fromCharCode` per
//                 output byte, the parts joined with `""`
//   small-copies  `copyBytes` of 1 to 64 bytes between two arrays
//   grow          a `u8[]` grown from empty by `push` to 4096 bytes
//   checked       an indexed read-modify-write loop, every access checked
//   json-strings  a `JsonWriter` object of sixteen short string members, the
//                 shape `nish_plain_base` scans

import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { foldStart, now, report } from "../crypto/lib/gen"

/** One FNV-1a step. */
const mix = (h: u32, b: i32): u32 => (h ^ toU32(b & 255)) * 16777619

/** The 64 characters of the base64url alphabet. */
const ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

/** 48 bytes, the input the `chars` and `small-copies` cases read. */
const source = (): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < 128; i++) {
    out.push(toU8((i * 37 + 11) & 255))
  }
  return out
}

/** `bytes[0 .. 48)` with `seed` in the first byte, as 64 base64url characters. */
const chars = (bytes: u8[], seed: i32, sum: u32): u32 => {
  bytes[0] = toU8(seed & 255)
  const parts: string[] = []
  for (let i: i32 = 0; i + 2 < 48 && i + 2 < toI32(bytes.length); i += 3) {
    const n: i32 = (toI32(bytes[i]) << 16) | (toI32(bytes[i + 1]) << 8) | toI32(bytes[i + 2])
    parts.push(String.fromCharCode(ALPHABET.charCodeAt((n >> 18) & 63)))
    parts.push(String.fromCharCode(ALPHABET.charCodeAt((n >> 12) & 63)))
    parts.push(String.fromCharCode(ALPHABET.charCodeAt((n >> 6) & 63)))
    parts.push(String.fromCharCode(ALPHABET.charCodeAt(n & 63)))
  }
  const text: string = parts.join("")
  let h: u32 = sum
  for (let i: i32 = 0; i < text.length; i++) {
    h = mix(h, text.charCodeAt(i))
  }
  return h
}

/** Every length from 1 to 64 copied once from `src` into `dst`. */
const smallCopies = (src: u8[], dst: u8[], seed: i32, sum: u32): u32 => {
  let h: u32 = sum
  for (let len: i32 = 1; len <= 64; len++) {
    const from: i32 = (seed + len) & 63
    const at: i32 = (seed * 7 + len) & 63
    copyBytes(dst, at, src, from, len)
    h = mix(h, toI32(dst[at + len - 1]))
  }
  return h
}

/** A fresh `u8[]` pushed to 4096 bytes. */
const grow = (seed: i32, sum: u32): u32 => {
  const out: u8[] = []
  for (let i: i32 = 0; i < 4096; i++) {
    out.push(toU8((i + seed) & 255))
  }
  return mix(mix(sum, toI32(out[toI32(out.length) - 1])), toI32(out.length))
}

/**
 * A stride walk over `data`, each index computed rather than counted, so the
 * checker cannot prove it in range and every read and write keeps its check:
 * the shape of a parser indexing by an offset it read.
 */
const checked = (data: u8[], seed: i32, sum: u32): u32 => {
  let at: i32 = seed & 1023
  let h: u32 = sum
  for (let i: i32 = 0; i < 1024; i++) {
    const b: i32 = toI32(data[at])
    data[at] = toU8((b + i) & 255)
    h = mix(h, b)
    at = (at + 389) & 1023
  }
  return h
}

/** The keys `json-strings` writes. */
const keys = (): string[] => [
  "id",
  "name",
  "email",
  "role",
  "team",
  "city",
  "country",
  "zip",
  "plan",
  "status",
  "locale",
  "tz",
  "theme",
  "lang",
  "device",
  "agent",
]

/** The values `json-strings` writes: short, with nothing to escape. */
const values = (): string[] => [
  "u_1849",
  "Ada Lovelace",
  "ada@example.com",
  "admin",
  "platform",
  "London",
  "GB",
  "NW1",
  "enterprise",
  "active",
  "en-GB",
  "Europe/London",
  "dark",
  "en",
  "laptop",
  "nish/0.34",
]

/** One object of sixteen string members into `w`, its bytes folded. */
const jsonStrings = (w: JsonWriter, buf: u8[], k: string[], v: string[], seed: i32, sum: u32): u32 => {
  w.reset(buf, 0)
  w.beginObject()
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    w.key(k[i])
    const at: i32 = (i + seed) & 15
    if (at < toI32(v.length)) {
      w.string(v[at])
    }
  }
  w.endObject()
  const end: i32 = w.written()
  return mix(mix(sum, end), toI32(buf[end - 2]))
}

/** Whether `name` is one of the cases. */
const isCase = (name: string): boolean =>
  name === "chars" ||
  name === "small-copies" ||
  name === "grow" ||
  name === "checked" ||
  name === "json-strings"

export const main = (): i32 => {
  const name: string = process.argv.length > 1 ? process.argv[1] : "chars"
  const iterations: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1
  if (!isCase(name) || iterations < 1) {
    writeError(`runtime-copies: usage: main <case> <iterations>, not ${name}\n`)
    return 2
  }
  const src: u8[] = source()
  const dst: u8[] = source()
  const data: u8[] = []
  for (let i: i32 = 0; i < 1024; i++) {
    data.push(toU8(i & 255))
  }
  const buf: u8[] = []
  for (let i: i32 = 0; i < 1024; i++) {
    buf.push(toU8(0))
  }
  const w: JsonWriter = new JsonWriter(buf, 0)
  const k: string[] = keys()
  const v: string[] = values()
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < iterations; i++) {
    if (name === "chars") {
      sum = chars(src, i, sum)
    } else if (name === "small-copies") {
      sum = smallCopies(src, dst, i, sum)
    } else if (name === "grow") {
      sum = grow(i, sum)
    } else if (name === "checked") {
      sum = checked(data, i, sum)
    } else {
      sum = jsonStrings(w, buf, k, v, i, sum)
    }
  }
  report(sum, started)
  return 0
}
