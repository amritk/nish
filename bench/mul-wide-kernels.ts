// WP41's bar (docs/wp41-mul-wide.md §2): the two Poly1305 kernels and the
// workload bench/mul-wide.ts times, apart from its `main` so that
// bench/mul-wide.mjs can link this file alone as freestanding wasm and time
// the same work under Node, the kernel picked by number.
//
// `base` is the radix-2^26 kernel `main` shipped, frozen below; `std` is the
// `poly1305` of nish/crypto/chacha20poly1305. The workload is 2^12 MACs,
// each over a 64 KiB message one byte different from the last, under one key,
// folded into an FNV-1a checksum of every tag, so no MAC can be computed once
// for the loop and the two kernels are seen to answer alike.
import { poly1305 } from "nish/crypto/chacha20poly1305"
import { wipe } from "nish:secret"

/** The message each MAC reads: 64 KiB. */
export const MESSAGE_BYTES: i32 = 65536

/** The MACs at scale 1: 2^12. */
export const MACS: i32 = 4096

// ---- The radix-2^26 kernel as `main` shipped it --------------------------------------------------
//
// poly1305Le64, poly1305Clamp, poly1305Block, poly1305Finish, poly1305Absorb
// and poly1305 of std/crypto/chacha20poly1305.ts at the commit before WP41,
// verbatim apart from a `base` prefix in place of `poly1305` and their doc
// comments, which that commit holds.

/** 2^128 as limb 4 sees it. */
const BASE_HIGH_BIT: i32 = 0x1000000

/** The little-endian `u32` at `buf[at]`. */
const baseWord = (buf: u8[], at: i32): u32 => {
  const p: u32 = toU32(at)
  return toU32(buf[p]) | (toU32(buf[p + 1]) << 8) | (toU32(buf[p + 2]) << 16) | (toU32(buf[p + 3]) << 24)
}

const baseLe64 = (buf: u8[], at: i32): u64 => {
  const p: u32 = toU32(at)
  return (
    toU64(buf[p]) |
    (toU64(buf[p + 1]) << 8) |
    (toU64(buf[p + 2]) << 16) |
    (toU64(buf[p + 3]) << 24) |
    (toU64(buf[p + 4]) << 32) |
    (toU64(buf[p + 5]) << 40) |
    (toU64(buf[p + 6]) << 48) |
    (toU64(buf[p + 7]) << 56)
  )
}

const baseClamp = (key: u8[], r: u64[]): void => {
  const lo: u64 = baseLe64(key, 0) & ((toU64(0x0ffffffc) << 32) | 0x0fffffff)
  const hi: u64 = baseLe64(key, 8) & ((toU64(0x0ffffffc) << 32) | 0x0ffffffc)
  r[0] = lo & 0x3ffffff
  r[1] = (lo >>> 26) & 0x3ffffff
  r[2] = ((lo >>> 52) | (hi << 12)) & 0x3ffffff
  r[3] = (hi >>> 14) & 0x3ffffff
  r[4] = hi >>> 40
}

const baseBlock = (h: u64[], r: u64[], m: u8[], at: i32, high: u64): void => {
  const lo: u64 = baseLe64(m, at)
  const hi: u64 = baseLe64(m, toI32(toU32(at) + 8))
  const h0: u64 = h[0] + (lo & 0x3ffffff)
  const h1: u64 = h[1] + ((lo >>> 26) & 0x3ffffff)
  const h2: u64 = h[2] + (((lo >>> 52) | (hi << 12)) & 0x3ffffff)
  const h3: u64 = h[3] + ((hi >>> 14) & 0x3ffffff)
  const h4: u64 = h[4] + ((hi >>> 40) | high)

  const r0: u64 = r[0]
  const r1: u64 = r[1]
  const r2: u64 = r[2]
  const r3: u64 = r[3]
  const r4: u64 = r[4]
  // A product that lands at limb 5 or above is 2^130 times something, and
  // 2^130 = 5 (mod p), so it comes back in at limb `i - 5` times five.
  const s1: u64 = r1 * 5
  const s2: u64 = r2 * 5
  const s3: u64 = r3 * 5
  const s4: u64 = r4 * 5

  let d0: u64 = h0 * r0 + h1 * s4 + h2 * s3 + h3 * s2 + h4 * s1
  let d1: u64 = h0 * r1 + h1 * r0 + h2 * s4 + h3 * s3 + h4 * s2
  let d2: u64 = h0 * r2 + h1 * r1 + h2 * r0 + h3 * s4 + h4 * s3
  let d3: u64 = h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * s4
  let d4: u64 = h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0

  // Carry each limb into the next, and the carry out of limb 4 into limb 0
  // times five; then limb 0's own carry once more.
  d1 = d1 + (d0 >>> 26)
  d2 = d2 + (d1 >>> 26)
  d3 = d3 + (d2 >>> 26)
  d4 = d4 + (d3 >>> 26)
  d0 = (d0 & 0x3ffffff) + (d4 >>> 26) * 5
  h[0] = d0 & 0x3ffffff
  h[1] = (d1 & 0x3ffffff) + (d0 >>> 26)
  h[2] = d2 & 0x3ffffff
  h[3] = d3 & 0x3ffffff
  h[4] = d4 & 0x3ffffff
}

const baseFinish = (h: u64[], key: u8[], tag: u8[]): void => {
  let h0: u64 = h[0]
  let h1: u64 = h[1]
  let h2: u64 = h[2]
  let h3: u64 = h[3]
  let h4: u64 = h[4]
  for (let pass: i32 = 0; pass < 2; pass++) {
    h1 = h1 + (h0 >>> 26)
    h0 = h0 & 0x3ffffff
    h2 = h2 + (h1 >>> 26)
    h1 = h1 & 0x3ffffff
    h3 = h3 + (h2 >>> 26)
    h2 = h2 & 0x3ffffff
    h4 = h4 + (h3 >>> 26)
    h3 = h3 & 0x3ffffff
    h0 = h0 + (h4 >>> 26) * 5
    h4 = h4 & 0x3ffffff
  }

  const g0: u64 = h0 + 5
  const g1: u64 = h1 + (g0 >>> 26)
  const g2: u64 = h2 + (g1 >>> 26)
  const g3: u64 = h3 + (g2 >>> 26)
  const g4: u64 = h4 + (g3 >>> 26) - 0x4000000
  // All ones when `g4` did not borrow, which is when `h >= p` and `g` is the
  // reduced value; all zeros otherwise.
  const keep: u64 = (g4 >>> 63) - 1
  h0 = ctSelect(keep, g0 & 0x3ffffff, h0)
  h1 = ctSelect(keep, g1 & 0x3ffffff, h1)
  h2 = ctSelect(keep, g2 & 0x3ffffff, h2)
  h3 = ctSelect(keep, g3 & 0x3ffffff, h3)
  h4 = ctSelect(keep, g4 & 0x3ffffff, h4)

  const word: u64 = 0xffffffff
  let f: u64 = ((h0 | (h1 << 26)) & word) + toU64(baseWord(key, 16))
  tag[0] = toU8(f)
  tag[1] = toU8(f >>> 8)
  tag[2] = toU8(f >>> 16)
  tag[3] = toU8(f >>> 24)
  f = (((h1 >>> 6) | (h2 << 20)) & word) + toU64(baseWord(key, 20)) + (f >>> 32)
  tag[4] = toU8(f)
  tag[5] = toU8(f >>> 8)
  tag[6] = toU8(f >>> 16)
  tag[7] = toU8(f >>> 24)
  f = (((h2 >>> 12) | (h3 << 14)) & word) + toU64(baseWord(key, 24)) + (f >>> 32)
  tag[8] = toU8(f)
  tag[9] = toU8(f >>> 8)
  tag[10] = toU8(f >>> 16)
  tag[11] = toU8(f >>> 24)
  f = (((h3 >>> 18) | (h4 << 8)) & word) + toU64(baseWord(key, 28)) + (f >>> 32)
  tag[12] = toU8(f)
  tag[13] = toU8(f >>> 8)
  tag[14] = toU8(f >>> 16)
  tag[15] = toU8(f >>> 24)
}

const baseAbsorb = (h: u64[], r: u64[], buf: u8[], at: i32, len: i32, zeroPad: boolean): void => {
  const whole: i32 = len >> 4
  for (let i: i32 = 0; i < whole; i++) {
    baseBlock(h, r, buf, at + 16 * i, toU64(BASE_HIGH_BIT))
  }
  const tail: i32 = len & 15
  if (tail > 0) {
    const last: u8[] = new Array<u8>(16)
    for (let i: i32 = 0; i < tail && i < toI32(last.length); i++) {
      last[i] = buf[at + 16 * whole + i]
    }
    if (zeroPad) {
      baseBlock(h, r, last, 0, toU64(BASE_HIGH_BIT))
    } else {
      last[tail] = 1
      baseBlock(h, r, last, 0, 0)
    }
  }
}

const basePoly1305 = (key: u8[], msg: u8[]): u8[] | null => {
  if (toI32(key.length) !== 32) {
    return null
  }
  const h: u64[] = new Array<u64>(5)
  const r: u64[] = new Array<u64>(5)
  baseClamp(key, r)
  baseAbsorb(h, r, msg, 0, toI32(msg.length), false)
  const tag: u8[] = new Array<u8>(16)
  baseFinish(h, key, tag)
  wipe(h)
  wipe(r)
  return tag
}

// ---- The workload --------------------------------------------------------------------------------

/** FNV-1a over the tag's little-endian words. */
const foldTag = (sum: u32, tag: u8[]): u32 => {
  let s: u32 = sum
  for (let at: i32 = 0; at + 3 < toI32(tag.length); at += 4) {
    const word: u32 =
      toU32(tag[at]) | (toU32(tag[at + 1]) << 8) | (toU32(tag[at + 2]) << 16) | (toU32(tag[at + 3]) << 24)
    s = (s ^ word) * 16777619
  }
  return s
}

/**
 * `macs` MACs under kernel `kernel` (0 `base`, 1 `std`), each over the
 * message with one more byte changed: MAC `i` writes `i` into byte
 * `(i * 4099) mod size`, so the changed byte walks the whole message. The
 * checksum of every tag, or 0 when a kernel answered `null`.
 */
export const macRun = (kernel: i32, macs: i32, size: i32): u32 => {
  const key: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    key[i] = toU8((i * 29 + 7) & 255)
  }
  const msg: u8[] = new Array<u8>(size)
  for (let i: i32 = 0; i < toI32(msg.length); i++) {
    msg[i] = toU8((i * 131 + 17) & 255)
  }
  let sum: u32 = 2166136261
  for (let i: i32 = 0; i < macs; i++) {
    const at: i32 = (i * 4099) % size
    if (at >= 0 && at < toI32(msg.length)) {
      msg[at] = toU8(i & 255)
    }
    const tag: u8[] | null = kernel === 0 ? basePoly1305(key, msg) : poly1305(key, msg)
    if (tag === null) {
      return 0
    }
    sum = foldTag(sum, tag)
  }
  return sum
}
