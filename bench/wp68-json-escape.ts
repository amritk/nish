// WP68 S1 (docs/wp68-shared-libraries.md §4): the JSON string quoters std/ and
// src/ carry, timed side by side, to pick the one a shared copy starts from.
// 4 MiB of text is cut into strings, mostly letters, with 0x7f or a byte at
// or above 0x80 now and then, and an escaped byte at random: a quote, a
// backslash, one of the five letter escapes, or a control byte that takes
// `\u00xx` (a-f digits included); each side quotes every string into one
// output and the program prints a checksum of that output, which must agree.
// Every round changes one byte at a position that moves with the round, so no
// round's input is another's. `byteB` is `byteA` byte for byte, so the
// distance between those two is the run's noise band. Only the quoting is
// timed; the checksum is read after the clock stops. The minimum of each side
// over the rounds is printed for each case, each with its own twin band and
// checksums: length and density vary apart (64 and 1024 bytes, each at 1 in
// 16 and 1 in 256 escaped), and 8, 16 and 32 bytes at 1 in 256 sit around
// `JSON_PLAIN_RUN_MIN` = 16 (std/json.ts), where std's writer turns from its
// byte loop to `runs`. Two lengths that are not a multiple of 8 (13 and 100
// bytes, at 1 in 256) and a million empty strings close the list; the empty
// case's output does not change from round to round, since it reads no byte:
//
//   build/seed/bin/nish bench/wp68-json-escape.ts --link build/wp68-json-escape --profile speed
//   taskset -c 2 build/wp68-json-escape
import { copyBytes, skipJsonPlain } from "nish/bytes"
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

const ROUNDS: i32 = 9
const SIZE: i32 = 4194304
const MOVE: i32 = 5237
/** How many strings the empty case quotes. */
const EMPTY_COUNT: i32 = 1048576
/** Room for every byte escaped as `\u00xx`, plus two quotes a string of one byte. */
const ROOM: i32 = SIZE * 8

/** `jsonShortEscape`, std/json.ts, with its named constants written out. */
const shortEscape = (code: i32): i32 => {
  if (code === 34 || code === 92) {
    return code
  }
  if (code === 10) {
    return 110
  }
  if (code === 9) {
    return 116
  }
  if (code === 13) {
    return 114
  }
  if (code === 8) {
    return 98
  }
  if (code === 12) {
    return 102
  }
  return 0
}

/** `jsonHexByte`, std/json.ts. */
const hexByte = (nibble: i32): i32 => (nibble < 10 ? 48 + nibble : 97 + nibble - 10)

/**
 * The byte loop of `jsonWriterPutBytes`, std/json.ts, which that function
 * runs below `JSON_PLAIN_RUN_MIN` and `jsonWriterPutString` runs over a
 * `string` at every length, with the cursor passed and returned rather than
 * kept in a writer: one test and one store a plain byte. -1 when `out` is
 * full. No shipped caller runs this loop over a byte window of 16 bytes or
 * more; `jsonWriterPutString` does over a `string`, which no side here times.
 */
const byteA = (out: u8[], at0: i32, src: u8[], off: i32, len: i32): i32 => {
  const cap: i32 = toI32(out.length)
  let at: i32 = at0
  if (at < 0 || at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  at += 1
  const stop: i32 = off + len
  for (let i: i32 = off; i >= 0 && i < stop && i < toI32(src.length); i += 1) {
    const code: i32 = toI32(src[i])
    if (code >= 32 && code !== 34 && code !== 92) {
      if (at >= cap) {
        return -1
      }
      out[at] = toU8(code)
      at += 1
      continue
    }
    const letter: i32 = shortEscape(code)
    if (letter !== 0) {
      if (at < 0 || at + 1 >= cap) {
        return -1
      }
      out[at] = toU8(92)
      out[at + 1] = toU8(letter)
      at += 2
      continue
    }
    if (at < 0 || at + 5 >= cap) {
      return -1
    }
    out[at] = toU8(92)
    out[at + 1] = toU8(117)
    out[at + 2] = toU8(48)
    out[at + 3] = toU8(48)
    out[at + 4] = toU8(hexByte(code >> 4))
    out[at + 5] = toU8(hexByte(code & 15))
    at += 6
  }
  if (at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  return at + 1
}

/** Its twin, for the noise band. */
const byteB = (out: u8[], at0: i32, src: u8[], off: i32, len: i32): i32 => {
  const cap: i32 = toI32(out.length)
  let at: i32 = at0
  if (at < 0 || at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  at += 1
  const stop: i32 = off + len
  for (let i: i32 = off; i >= 0 && i < stop && i < toI32(src.length); i += 1) {
    const code: i32 = toI32(src[i])
    if (code >= 32 && code !== 34 && code !== 92) {
      if (at >= cap) {
        return -1
      }
      out[at] = toU8(code)
      at += 1
      continue
    }
    const letter: i32 = shortEscape(code)
    if (letter !== 0) {
      if (at < 0 || at + 1 >= cap) {
        return -1
      }
      out[at] = toU8(92)
      out[at + 1] = toU8(letter)
      at += 2
      continue
    }
    if (at < 0 || at + 5 >= cap) {
      return -1
    }
    out[at] = toU8(92)
    out[at + 1] = toU8(117)
    out[at + 2] = toU8(48)
    out[at + 3] = toU8(48)
    out[at + 4] = toU8(hexByte(code >> 4))
    out[at + 5] = toU8(hexByte(code & 15))
    at += 6
  }
  if (at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  return at + 1
}

/** `jsonWriterPutRuns`, std/json.ts, reshaped as `byteA` is: plain runs found by `skipJsonPlain` and moved by `copyBytes`. */
const runs = (out: u8[], at0: i32, src: u8[], off: i32, len: i32): i32 => {
  const cap: i32 = toI32(out.length)
  let at: i32 = at0
  if (at < 0 || at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  at += 1
  const stop: i32 = off + len
  let i: i32 = off
  while (i >= 0 && i < stop && i < toI32(src.length)) {
    const run: i32 = skipJsonPlain(src, i, stop)
    const count: i32 = run - i
    if (count > 0) {
      if (at > cap - count) {
        return -1
      }
      copyBytes(out, at, src, i, count)
      at += count
      i = run
    }
    if (i < 0 || i >= stop || i >= toI32(src.length)) {
      break
    }
    const code: i32 = toI32(src[i])
    i += 1
    const letter: i32 = shortEscape(code)
    if (letter !== 0) {
      if (at < 0 || at + 1 >= cap) {
        return -1
      }
      out[at] = toU8(92)
      out[at + 1] = toU8(letter)
      at += 2
      continue
    }
    if (at < 0 || at + 5 >= cap) {
      return -1
    }
    out[at] = toU8(92)
    out[at + 1] = toU8(117)
    out[at + 2] = toU8(48)
    out[at + 3] = toU8(48)
    out[at + 4] = toU8(hexByte(code >> 4))
    out[at + 5] = toU8(hexByte(code & 15))
    at += 6
  }
  if (at >= cap) {
    return -1
  }
  out[at] = toU8(34)
  return at + 1
}

/** `hexDigitLower`, src/strings.ts. */
const hexDigitLower = (n: i32): string => "0123456789abcdef".substring(n & 15, (n & 15) + 1)

/**
 * `addJsonQuoted`, src/strings.ts, with `StringBuilder`'s `parts` as a plain
 * array and its `add` and `addChar` written out: each pushes the part
 * (`addChar` as `String.fromCharCode`) as the method bodies do, without the
 * method call.
 */
const builder = (parts: string[], s: string): void => {
  parts.push(String.fromCharCode(34))
  let i = 0
  while (i < s.length) {
    const c = s.charCodeAt(i)
    if (c === 34) {
      parts.push('\\"')
    } else if (c === 92) {
      parts.push("\\\\")
    } else if (c === 8) {
      parts.push("\\b")
    } else if (c === 9) {
      parts.push("\\t")
    } else if (c === 10) {
      parts.push("\\n")
    } else if (c === 12) {
      parts.push("\\f")
    } else if (c === 13) {
      parts.push("\\r")
    } else if (c < 32) {
      parts.push("\\u00")
      parts.push(hexDigitLower(c >> 4))
      parts.push(hexDigitLower(c))
    } else {
      parts.push(String.fromCharCode(c))
    }
    i = i + 1
  }
  parts.push(String.fromCharCode(34))
}

/** The bytes `out[0 .. end)` folded, each weighted by its place in an eight-byte cycle. */
const fold = (out: u8[], end: i32): i64 => {
  let s: i64 = toI64(end)
  for (let i: i32 = 0; i < end && i < toI32(out.length); i += 1) {
    s += toI64(out[i]) * toI64((i & 7) + 1)
  }
  return s
}

/** The same fold over a `string`. */
const foldText = (text: string): i64 => {
  let s: i64 = toI64(text.length)
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    s += toI64(text.charCodeAt(i)) * toI64((i & 7) + 1)
  }
  return s
}

// biome-ignore format: one class a row
/** The bytes an escape is drawn from: the two-letter escapes, then bytes below 32 that take `\u00xx`, the a-f digits among them. */
const ESCAPED: readonly u8[] = [
  34, 92, 10, 9, 13, 8, 12,
  0, 1, 11, 14, 15, 26, 27, 31,
]

/** One of the bytes of the input: when `x & mask` is 0 to 3, a byte of `ESCAPED`; otherwise a letter, or 1 time in 16 a byte that needs no escape but is not a letter (0x7f, or one at or above 0x80). */
const symbol = (x: u32, mask: u32): u8 => {
  const pick: u32 = x & mask
  const at: i32 = toI32((x >> 12) % toU32(ESCAPED.length))
  if (pick < 4 && at >= 0 && at < ESCAPED.length) {
    return ESCAPED[at]
  }
  const other: u32 = (x >> 8) & 15
  if (other === 0) {
    return toU8(127)
  }
  if (other === 1) {
    return toU8(128 + toI32((x >> 16) & 127))
  }
  return toU8(97 + toI32((x >> 16) % 26))
}

/** How many strings of `size` bytes a case quotes: every whole one in `SIZE`, or `EMPTY_COUNT` empty ones. */
const countOf = (size: i32): i32 => (size > 0 ? SIZE / size : EMPTY_COUNT)

/** Quotes every string of `src` with byte side `side` into `out`; the end, or -1 when it ran out of room. */
const quoteAll = (out: u8[], src: u8[], side: i32, size: i32): i32 => {
  let at: i32 = 0
  const count: i32 = countOf(size)
  for (let n: i32 = 0; n < count && at >= 0; n += 1) {
    const off: i32 = n * size
    if (side === 0) {
      at = byteA(out, at, src, off, size)
    } else if (side === 1) {
      at = byteB(out, at, src, off, size)
    } else {
      at = runs(out, at, src, off, size)
    }
  }
  return at
}

/** Times every side over strings of `size` bytes, four bytes in `mask + 1` escaped, and prints the report under `title`. */
const measure = (title: string, size: i32, mask: u32): i32 => {
  console.log(title)
  const src = new Array<u8>(SIZE)
  let x: u32 = 2463534242
  for (let i = 0; i < SIZE && i < src.length; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    src[i] = symbol(x, mask)
  }
  const out = new Array<u8>(ROOM)
  const names: string[] = ["byteA", "byteB", "runs", "builder"]
  const best: i64[] = [-1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= src.length) {
      return 1
    }
    const pick: i32 = round % toI32(ESCAPED.length)
    if (pick < 0 || pick >= ESCAPED.length) {
      return 1
    }
    src[at] = ESCAPED[pick]
    // The `string` copies `builder` reads, made before any clock starts.
    const texts: string[] = []
    const count: i32 = countOf(size)
    for (let n: i32 = 0; n < count; n += 1) {
      const off: i32 = n * size
      const one: string[] = []
      for (let i: i32 = off; i >= 0 && i < off + size && i < src.length; i += 1) {
        one.push(String.fromCharCode(toI32(src[i])))
      }
      texts.push(one.join(""))
    }
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 4; k++) {
      const side: i32 = (round + k) % 4
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      let s: i64 = 0
      const t0 = monotonicNanos()
      if (side < 3) {
        const end: i32 = quoteAll(out, src, side, size)
        best[side] = least(best[side], monotonicNanos() - t0)
        s = fold(out, end)
      } else {
        const parts: string[] = []
        for (const text of texts) {
          builder(parts, text)
        }
        const joined = parts.join("")
        best[side] = least(best[side], monotonicNanos() - t0)
        s = foldText(joined)
      }
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  let failed: i32 = 0
  // Length and density apart: each length at both densities.
  failed += measure("64-byte strings, 1 byte in 16 escaped", 64, 63)
  failed += measure("64-byte strings, 1 byte in 256 escaped", 64, 1023)
  failed += measure("1024-byte strings, 1 byte in 16 escaped", 1024, 63)
  failed += measure("1024-byte strings, 1 byte in 256 escaped", 1024, 1023)
  // Around JSON_PLAIN_RUN_MIN = 16 (std/json.ts), at one density.
  failed += measure("8-byte strings, 1 byte in 256 escaped", 8, 1023)
  failed += measure("16-byte strings, 1 byte in 256 escaped", 16, 1023)
  failed += measure("32-byte strings, 1 byte in 256 escaped", 32, 1023)
  // Lengths that are not a multiple of 8, and the empty string.
  failed += measure("13-byte strings, 1 byte in 256 escaped", 13, 1023)
  failed += measure("100-byte strings, 1 byte in 256 escaped", 100, 1023)
  failed += measure("empty strings, a million of them", 0, 1023)
  return failed
}
