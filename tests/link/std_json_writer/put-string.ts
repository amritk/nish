// The string seam: `jsonPutString` natively writes through the runtime's
// `nish_json_put_string`, sixteen bytes a block; Node and --emit-ts run
// `jsonPutStringWalk` as written. Each must write what `JsonWriter.stringBytes`
// writes for the same window, byte for byte: every byte value at every offset
// of strings up to 40 bytes (so each lands in each lane of a block and in the
// overlapping tail), pseudo-random strings over the bytes that need escaping
// and those that do not, from odd offsets of the source into odd offsets of
// the destination, and a destination one byte short of each answer, which is
// -1. tests/run.js (`json_string_seam`) holds the native build and the Node
// prelude to put-string.out, and checks the call in std/json's IR.
import { JSON_WRITE_OK, JsonWriter, jsonPutString } from "nish/json"

/** `JsonWriter.stringBytes`'s answer for `src[from .. from + len)`, in `ref`, and its length; -1 when it failed. */
const reference = (ref: u8[], src: u8[], from: i32, len: i32): i32 => {
  const w = new JsonWriter(ref, 0)
  w.stringBytes(src, from, len)
  return w.failed === JSON_WRITE_OK ? w.written() : -1
}

/**
 * Whether `jsonPutString` agrees with `reference` for `src[from .. from + len)`
 * written at `at`: the same bytes and the end after them, -1 into a
 * destination one byte short, and nothing written before `at`.
 */
const agrees = (src: u8[], from: i32, len: i32, at: i32, ref: u8[], dst: u8[]): boolean => {
  const want = reference(ref, src, from, len)
  if (want < 0) return false
  for (let i = 0; i < dst.length; i++) dst[i] = 0xee
  const end = jsonPutString(dst, at, src, from, len)
  if (end !== at + want) return false
  for (let i = 0; i < at; i++) {
    if (dst[i] !== 0xee) return false
  }
  for (let i = 0; i < want; i++) {
    if (dst[at + i] !== ref[i]) return false
  }
  const tight = new Array<u8>(at + want);
  if (jsonPutString(tight, at, src, from, len) !== at + want) return false
  const short = new Array<u8>(at + want - 1);
  return jsonPutString(short, at, src, from, len) === -1
}

/** The bytes of `s`, one a character, for the ASCII literals below. */
const bytesOf = (s: string): u8[] => {
  const b = new Array<u8>(s.length);
  for (let i = 0; i < s.length; i++) b[i] = toU8(s.charCodeAt(i));
  return b
}

/** `dst[0 .. n)` as text, for the literal cases' lines. */
const shown = (dst: u8[], n: i32): string => {
  let s = ""
  for (let i = 0; i < n; i++) s = s + String.fromCharCode(dst[i])
  return s
}

export const main = (): i32 => {
  const ref = new Array<u8>(4096);
  const dst = new Array<u8>(4096);

  // Every byte value at every offset of every length up to 40, the rest of
  // the string plain.
  let cases = 0
  let bad = 0
  const src = new Array<u8>(64);
  for (let len = 1; len <= 40; len++) {
    for (let pos = 0; pos < len; pos++) {
      for (let v = 0; v < 256; v++) {
        for (let i = 0; i < len; i++) src[i] = toU8(97 + (i % 26))
        src[pos] = toU8(v)
        cases++
        if (!agrees(src, 0, len, 0, ref, dst)) bad++
      }
    }
  }
  console.log(`every byte at every offset: ${cases} cases, ${bad} disagree`)

  // Pseudo-random strings over an alphabet weighted toward the bytes that
  // need escaping, read from and written to odd offsets.
  const alphabet: u8[] = [0, 1, 8, 9, 10, 12, 13, 31, 32, 34, 47, 92, 97, 98, 122, 126, 127, 128, 194, 226, 255]
  const big = new Array<u8>(600);
  let seed: u32 = 12345
  cases = 0
  bad = 0
  for (let n = 0; n < 2000; n++) {
    seed = seed * 1103515245 + 12345
    const len = toI32((seed >>> 8) % 300)
    seed = seed * 1103515245 + 12345
    const from = toI32((seed >>> 8) % 17)
    seed = seed * 1103515245 + 12345
    const at = toI32((seed >>> 8) % 13)
    for (let i = 0; i < len; i++) {
      seed = seed * 1103515245 + 12345
      // Mostly plain runs, so blocks of sixteen are both all plain and not.
      const pick = (seed >>> 16) % 64
      big[from + i] = pick < toU32(alphabet.length) ? alphabet[toI32(pick)] : toU8(97 + toI32(pick % 26))
    }
    cases++
    if (!agrees(big, from, len, at, ref, dst)) bad++
  }
  console.log(`random strings: ${cases} cases, ${bad} disagree`)

  const lines: string[] = ["", "plain", 'say "hi"', "back\\slash", "tab\there\nline", "\u0001\u001f"]
  for (const s of lines) {
    const b = bytesOf(s)
    const end = jsonPutString(dst, 0, b, 0, b.length)
    console.log(shown(dst, end))
  }

  // Windows outside the source, and cursors outside the destination.
  const five = bytesOf("abcde")
  console.log(
    `${jsonPutString(dst, 0, five, -1, 2)} ${jsonPutString(dst, 0, five, 0, -1)} ${jsonPutString(dst, 0, five, 3, 3)} ` +
      `${jsonPutString(dst, 0, five, 5, 0)} ${jsonPutString(dst, -1, five, 0, 5)} ${jsonPutString(dst, dst.length, five, 0, 0)} ` +
      `${jsonPutString(new Array<u8>(0), 0, five, 0, 0)} ${jsonPutString(new Array<u8>(2), 0, five, 0, 0)}`
  )
  return 0
}
