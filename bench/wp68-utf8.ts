// WP68 S1 (docs/wp68-shared-libraries.md §4): the strict UTF-8 validators
// std/ carries, timed side by side, to pick the one a shared copy starts from.
// 4 MiB of text is cut into 4 KiB segments, each well formed on its own; each
// side validates every segment and folds which ones pass into a checksum the
// program prints, and all must agree. Every round breaks one byte at a
// position that moves with the round, so each round has a different invalid
// segment. `urlB` is `urlA` byte for byte, so the distance between those two
// is the run's noise band. The minimum of each side over the rounds is
// printed, for two texts: `mixed` (a quarter of the symbols non-ASCII) and
// `ascii` (one in 64):
//
//   build/seed/bin/nish bench/wp68-utf8.ts --link build/wp68-utf8 --profile speed
//   taskset -c 2 build/wp68-utf8
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

const ROUNDS: i32 = 9
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

/** A window walked with `bytesUtf8Length`, the way std/bytes.ts's `skipJsonText` walks one. */
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

/** A window walked with `jsonTokUtf8Length`, as the tokenizer walks a string body. */
const jsonTokWalk = (buf: u8[], off: i32, len: i32): boolean => {
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
      ok = jsonTokWalk(buf, off, SEGMENT)
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

/** Times every side over `buf` and prints the report under `title`. */
const measure = (title: string, buf: u8[]): i32 => {
  console.log(title)
  const names: string[] = ["urlA", "urlB", "bytesWalk", "jsonTokWalk", "wordSkip"]
  const best: i64[] = [-1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= buf.length) {
      return 1
    }
    const kept: u8 = buf[at]
    buf[at] = toU8(0xff)
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 5; k++) {
      const side: i32 = (round + k) % 5
      const t0 = monotonicNanos()
      let s: i64 = 0
      for (let p = 0; p < PASSES; p++) {
        s += segments(buf, side)
      }
      best[side] = least(best[side], monotonicNanos() - t0)
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
    buf[at] = kept
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  const mixed = measure("mixed: 16 of 64 symbols not ASCII", text(16))
  const ascii = measure("ascii: 1 of 64 symbols not ASCII", text(1))
  return mixed + ascii
}
