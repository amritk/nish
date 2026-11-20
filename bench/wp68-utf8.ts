// WP68 S1 (docs/wp68-shared-libraries.md §4): the strict UTF-8 validators
// std/ carries, timed side by side, to pick the one a shared copy starts from.
// 4 MiB of text is cut into 4 KiB segments, each well formed on its own; each
// side validates every segment and folds which ones pass into a checksum the
// program prints, and all must agree. Every round breaks the text at a
// position that moves with the round, so each round has a different invalid
// segment, and with a different ill-formed case: 0xFF, a lone continuation
// byte, overlongs, surrogates, values above U+10FFFF, and forms cut short by a
// letter, by the segment's end or by the end of the buffer (`breakAt`). `urlB`
// is `urlA` byte for byte, so the distance between those two is the run's
// noise band. The minimum of each side over the rounds is printed, for two
// texts: `mixed` (a quarter of the symbols non-ASCII) and `ascii` (one in 64).
//
// `jsonTokLoop` is a synthetic driver: `jsonTokUtf8Length` called from a byte
// loop of this bench's own, which the tokenizer does not have. `kernel` is the
// tokenizer's real path: `skipJsonText` from `nish/bytes` (which
// `jsonTokSkipPlain` calls), then `jsonTokUtf8Length` at the byte where the run
// stopped. Built natively, `skipJsonText` is the runtime's
// `nish_bytes_skip_json_text` (src/kernels.ts), whose block width
// `nish_run_choose` picks when the program starts: 32 bytes with AVX2, 16
// with SSE2, or as `NISH_SIMD` says.
//
//   build/seed/bin/nish bench/wp68-utf8.ts --link build/wp68-utf8 --profile speed
//   taskset -c 2 build/wp68-utf8
import { monotonicNanos } from "nish:process"
import { skipJsonText } from "nish/bytes"
import { least, report } from "./wp68-report"

/** One round for each ill-formed case `breakAt` writes. */
const ROUNDS: i32 = 12
const PASSES: i32 = 10
const SIZE: i32 = 4194304
const SEGMENT: i32 = 4096
const MOVE: i32 = 5237

/** `urlIsUtf8`, std/net/url.ts, verbatim but for its name: the whole-buffer walk with its own ASCII step. */
const urlA = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  const n: i32 = toI32(buf.length)
  while (i >= 0 && i < end && i < n) {
    const b: i32 = toI32(buf[i])
    if (b < 0x80) {
      i += 1
      continue
    }
    let need: i32 = 0
    let lo: i32 = 0x80
    let hi: i32 = 0xbf
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b === 0xe0) {
      need = 2
      lo = 0xa0
    } else if (b === 0xed) {
      need = 2
      hi = 0x9f
    } else if (b >= 0xe1 && b <= 0xef) {
      need = 2
    } else if (b === 0xf0) {
      need = 3
      lo = 0x90
    } else if (b === 0xf4) {
      need = 3
      hi = 0x8f
    } else if (b >= 0xf1 && b <= 0xf3) {
      need = 3
    } else {
      return false
    }
    if (end - i - 1 < need || i + 1 >= n) {
      return false
    }
    const second: i32 = toI32(buf[i + 1])
    if (second < lo || second > hi) {
      return false
    }
    let k: i32 = 2
    while (k <= need) {
      const c: i32 = toI32(buf[i + k])
      if (c < 0x80 || c > 0xbf) {
        return false
      }
      k += 1
    }
    i += need + 1
  }
  return true
}

/** Its twin, for the noise band. */
const urlB = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  const n: i32 = toI32(buf.length)
  while (i >= 0 && i < end && i < n) {
    const b: i32 = toI32(buf[i])
    if (b < 0x80) {
      i += 1
      continue
    }
    let need: i32 = 0
    let lo: i32 = 0x80
    let hi: i32 = 0xbf
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b === 0xe0) {
      need = 2
      lo = 0xa0
    } else if (b === 0xed) {
      need = 2
      hi = 0x9f
    } else if (b >= 0xe1 && b <= 0xef) {
      need = 2
    } else if (b === 0xf0) {
      need = 3
      lo = 0x90
    } else if (b === 0xf4) {
      need = 3
      hi = 0x8f
    } else if (b >= 0xf1 && b <= 0xf3) {
      need = 3
    } else {
      return false
    }
    if (end - i - 1 < need || i + 1 >= n) {
      return false
    }
    const second: i32 = toI32(buf[i + 1])
    if (second < lo || second > hi) {
      return false
    }
    let k: i32 = 2
    while (k <= need) {
      const c: i32 = toI32(buf[i + k])
      if (c < 0x80 || c > 0xbf) {
        return false
      }
      k += 1
    }
    i += need + 1
  }
  return true
}

/** `bytesUtf8Length`, std/bytes.ts, verbatim but for its name and its two constants written out. */
const bytesUtf8Length = (b: u8[], i: i32, to: i32): i32 => {
  const lead: i32 = toI32(b[i])
  let low: i32 = 0x80
  let high: i32 = 0xbf
  let n: i32 = 0
  if (lead >= 0xc2 && lead <= 0xdf) {
    n = 2
  } else if (lead >= 0xe0 && lead <= 0xef) {
    n = 3
    if (lead === 0xe0) {
      low = 0xa0
    }
    if (lead === 0xed) {
      high = 0x9f
    }
  } else if (lead >= 0xf0 && lead <= 0xf4) {
    n = 4
    if (lead === 0xf0) {
      low = 0x90
    }
    if (lead === 0xf4) {
      high = 0x8f
    }
  } else {
    return 0
  }
  if (to - i < n) {
    return 0
  }
  const second: i32 = toI32(b[i + 1])
  if (second < low || second > high) {
    return 0
  }
  let k: i32 = 2
  while (k < n) {
    const c: i32 = toI32(b[i + k])
    if (c < 0x80 || c > 0xbf) {
      return 0
    }
    k += 1
  }
  return n
}

/**
 * A driver this bench wrote, not shipped code: an ASCII skip around a copy of
 * the private `bytesUtf8Length`. std/bytes.ts's `skipJsonTextWalk` also tests
 * each byte for a control, a quote and a backslash, and natively the kernel
 * replaces that walk, so this side times the per-sequence decode alone.
 */
const bytesWalk = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  while (i >= 0 && i < end && i < toI32(buf.length)) {
    if (toI32(buf[i]) < 0x80) {
      i += 1
      continue
    }
    const n: i32 = bytesUtf8Length(buf, i, end)
    if (n === 0) {
      return false
    }
    i += n
  }
  return true
}

/** `jsonTokByteAt`, std/json-tokenizer.ts. */
const jsonTokByteAt = (src: u8[], i: i32, end: i32): i32 => {
  if (i < 0 || i >= end || i >= toI32(src.length)) {
    return -1
  }
  return toI32(src[i])
}

/** `jsonTokInRange`, std/json-tokenizer.ts. */
const jsonTokInRange = (b: i32, low: i32, high: i32): boolean => b >= low && b <= high

/** `jsonTokUtf8Length`, std/json-tokenizer.ts, with its named constants written out (-1 for both errors). */
const jsonTokUtf8Length = (src: u8[], at: i32, end: i32): i32 => {
  const lead: i32 = jsonTokByteAt(src, at, end)
  const second: i32 = jsonTokByteAt(src, at + 1, end)
  let low: i32 = 0x80
  let high: i32 = 0xbf
  let length: i32 = 0
  if (jsonTokInRange(lead, 0xc2, 0xdf)) {
    length = 2
  } else if (jsonTokInRange(lead, 0xe0, 0xef)) {
    length = 3
    if (lead === 0xe0) {
      low = 0xa0
    } else if (lead === 0xed) {
      high = 0x9f
    }
  } else if (jsonTokInRange(lead, 0xf0, 0xf4)) {
    length = 4
    if (lead === 0xf0) {
      low = 0x90
    } else if (lead === 0xf4) {
      high = 0x8f
    }
  } else {
    return -1
  }
  if (!jsonTokInRange(second, low, high)) {
    return -1
  }
  let k: i32 = 2
  while (k < length) {
    const next: i32 = jsonTokByteAt(src, at + k, end)
    if (!jsonTokInRange(next, 0x80, 0xbf)) {
      return -1
    }
    k += 1
  }
  return length
}

/** A synthetic driver: a window walked byte by byte, `jsonTokUtf8Length` at every byte from 0x80. */
const jsonTokLoop = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  while (i >= 0 && i < end && i < toI32(buf.length)) {
    if (toI32(buf[i]) < 0x80) {
      i += 1
      continue
    }
    const n: i32 = jsonTokUtf8Length(buf, i, end)
    if (n < 0) {
      return false
    }
    i += n
  }
  return true
}

/**
 * The tokenizer's path through a string body: the run `skipJsonText` steps
 * over, then `jsonTokUtf8Length` at the byte it stopped on. The text holds no
 * quote, backslash or control byte, so an ASCII stop is stepped over as the
 * tokenizer's plain-byte branch would.
 */
const kernel = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  while (i >= 0 && i < end && i < toI32(buf.length)) {
    i = skipJsonText(buf, i, end)
    if (i < 0 || i >= end || i >= toI32(buf.length)) {
      break
    }
    if (toI32(buf[i]) < 0x80) {
      i += 1
      continue
    }
    const n: i32 = jsonTokUtf8Length(buf, i, end)
    if (n < 0) {
      return false
    }
    i += n
  }
  return true
}

/** The candidate: `urlA` that first steps over eight ASCII bytes at a time. */
const wordSkip = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  const n: i32 = toI32(buf.length)
  while (i >= 0 && i < end && i < n) {
    while (i >= 0 && i + 8 <= end && i + 8 <= n) {
      const any: i32 =
        toI32(buf[i]) |
        toI32(buf[i + 1]) |
        toI32(buf[i + 2]) |
        toI32(buf[i + 3]) |
        toI32(buf[i + 4]) |
        toI32(buf[i + 5]) |
        toI32(buf[i + 6]) |
        toI32(buf[i + 7])
      if (any >= 0x80) {
        break
      }
      i += 8
    }
    if (i < 0 || i >= end || i >= n) {
      break
    }
    const b: i32 = toI32(buf[i])
    if (b < 0x80) {
      i += 1
      continue
    }
    let need: i32 = 0
    let lo: i32 = 0x80
    let hi: i32 = 0xbf
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b === 0xe0) {
      need = 2
      lo = 0xa0
    } else if (b === 0xed) {
      need = 2
      hi = 0x9f
    } else if (b >= 0xe1 && b <= 0xef) {
      need = 2
    } else if (b === 0xf0) {
      need = 3
      lo = 0x90
    } else if (b === 0xf4) {
      need = 3
      hi = 0x8f
    } else if (b >= 0xf1 && b <= 0xf3) {
      need = 3
    } else {
      return false
    }
    if (end - i - 1 < need || i + 1 >= n) {
      return false
    }
    const second: i32 = toI32(buf[i + 1])
    if (second < lo || second > hi) {
      return false
    }
    let k: i32 = 2
    while (k <= need) {
      const c: i32 = toI32(buf[i + k])
      if (c < 0x80 || c > 0xbf) {
        return false
      }
      k += 1
    }
    i += need + 1
  }
  return true
}

/** Which segments `side` accepts, folded with their indices. */
const segments = (buf: u8[], side: i32): i64 => {
  let s: i64 = 0
  let seg: i32 = 0
  while (seg * SEGMENT < SIZE) {
    const off: i32 = seg * SEGMENT
    let ok = false
    if (side === 0) {
      ok = urlA(buf, off, SEGMENT)
    } else if (side === 1) {
      ok = urlB(buf, off, SEGMENT)
    } else if (side === 2) {
      ok = bytesWalk(buf, off, SEGMENT)
    } else if (side === 3) {
      ok = jsonTokLoop(buf, off, SEGMENT)
    } else if (side === 4) {
      ok = kernel(buf, off, SEGMENT)
    } else {
      ok = wordSkip(buf, off, SEGMENT)
    }
    if (ok) {
      s += toI64(seg + 1)
    }
    seg += 1
  }
  return s
}

/**
 * `SIZE` bytes of well-formed segments: of each 64 symbols drawn, `wide` are
 * not ASCII, split over two-, three- and four-byte forms, and a segment's tail
 * that a symbol would cross is filled with letters.
 */
const text = (wide: u32): u8[] => {
  const buf = new Array<u8>(SIZE)
  let x: u32 = 2463534242
  let i: i32 = 0
  while (i >= 0 && i < SIZE && i < toI32(buf.length)) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    const pick: u32 = x & 63
    const room: i32 = SEGMENT - (i % SEGMENT)
    if (pick >= wide || room < 4 || i + 4 > toI32(buf.length)) {
      buf[i] = toU8(97 + toI32((x >> 8) % 26))
      i += 1
    } else if (pick % 3 === 0) {
      buf[i] = toU8(0xc3)
      buf[i + 1] = toU8(0xa9)
      i += 2
    } else if (pick % 3 === 1) {
      buf[i] = toU8(0xe2)
      buf[i + 1] = toU8(0x82)
      buf[i + 2] = toU8(0xac)
      i += 3
    } else {
      buf[i] = toU8(0xf0)
      buf[i + 1] = toU8(0x9f)
      buf[i + 2] = toU8(0x98)
      buf[i + 3] = toU8(0x80)
      i += 4
    }
  }
  return buf
}

// biome-ignore format: one sequence a row, padded with 0 to four bytes
/**
 * The ill-formed sequences a round writes, one a round, four bytes a row with
 * the count in `BROKEN_LEN`: a byte never in UTF-8, a lone continuation byte,
 * three overlongs, two surrogates, two values above U+10FFFF and a truncated
 * form cut short by a letter. The eleventh case, a four-byte form cut short by
 * the end of its segment, and the twelfth, one cut short by the end of the
 * buffer, are written by `breakAt`.
 */
const BROKEN: readonly u8[] = [
  0xff, 0, 0, 0,
  0x80, 0, 0, 0,
  0xc0, 0xaf, 0, 0,
  0xe0, 0x80, 0xaf, 0,
  0xf0, 0x80, 0x80, 0xaf,
  0xed, 0xa0, 0x80, 0,
  0xed, 0xbf, 0xbf, 0,
  0xf4, 0x90, 0x80, 0x80,
  0xf5, 0x80, 0x80, 0x80,
  0xe2, 0x82, 0x61, 0,
]
const BROKEN_LEN: readonly i32[] = [1, 1, 2, 3, 4, 3, 3, 4, 4, 3]
/** The case that `breakAt` writes at a segment's end rather than from the table. */
const CUT_AT_END: i32 = 10
/** The case that `breakAt` writes at the end of the buffer, the last segment's end. */
const CUT_AT_BUFFER_END: i32 = 11

/**
 * Breaks `buf` near `at0` with case `which`, and answers where it wrote, or
 * -1 when it could not. A table case starts at the first character boundary
 * at or before `at0` and stays inside its segment; `CUT_AT_END` writes the
 * first three bytes of a four-byte form over the last three of the segment.
 * `text` writes letters there unless a symbol starting four bytes from the
 * end crosses into them; then the overwrite also cuts that symbol short, so
 * the window is ill-formed either way, though not always first at the cut.
 */
const breakAt = (buf: u8[], at0: i32, which: i32): i32 => {
  const n: i32 = toI32(buf.length)
  if (which === CUT_AT_END || which === CUT_AT_BUFFER_END) {
    const at: i32 = which === CUT_AT_END ? at0 - (at0 % SEGMENT) + SEGMENT - 3 : n - 3
    if (at < 0 || at + 2 >= n) {
      return -1
    }
    buf[at] = toU8(0xf0)
    buf[at + 1] = toU8(0x9f)
    buf[at + 2] = toU8(0x98)
    return at
  }
  if (which < 0 || which >= BROKEN_LEN.length) {
    return -1
  }
  const len: i32 = BROKEN_LEN[which]
  let at: i32 = at0
  const room: i32 = SEGMENT - (at % SEGMENT)
  if (room < len) {
    at -= len - room
  }
  while (at > 0 && at < n && buf[at] >= 0x80 && buf[at] <= 0xbf) {
    at -= 1
  }
  for (let k: i32 = 0; k < len; k += 1) {
    const from: i32 = which * 4 + k
    if (at + k < 0 || at + k >= n || from < 0 || from >= BROKEN.length) {
      return -1
    }
    buf[at + k] = BROKEN[from]
  }
  return at
}

/** Times every side over `buf` and prints the report under `title`. */
const measure = (title: string, buf: u8[]): i32 => {
  console.log(title)
  const names: string[] = ["urlA", "urlB", "bytesWalk", "jsonTokLoop", "kernel", "wordSkip"]
  const best: i64[] = [-1, -1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0, 0]
  const kept = new Array<u8>(SIZE)
  for (let i: i32 = 0; i < SIZE && i < toI32(buf.length) && i < toI32(kept.length); i += 1) {
    kept[i] = buf[i]
  }
  for (let round = 0; round < ROUNDS; round++) {
    // Each round writes a different ill-formed case, the last two at a segment's end and the buffer's.
    const at: i32 = breakAt(buf, (round * MOVE) % SIZE, round)
    if (at < 0) {
      return 1
    }
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 6; k++) {
      const side: i32 = (round + k) % 6
      const t0 = monotonicNanos()
      let s: i64 = 0
      for (let p = 0; p < PASSES; p++) {
        s += segments(buf, side)
      }
      best[side] = least(best[side], monotonicNanos() - t0)
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
    for (let k: i32 = 0; k < 4; k += 1) {
      if (at + k >= 0 && at + k < toI32(buf.length) && at + k < toI32(kept.length)) {
        buf[at + k] = kept[at + k]
      }
    }
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  const mixed = measure("mixed: 16 of 64 symbols not ASCII", text(16))
  const ascii = measure("ascii: 1 of 64 symbols not ASCII", text(1))
  return mixed + ascii
}
