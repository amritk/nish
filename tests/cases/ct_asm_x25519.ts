// WP34 K4 under the N6 assembly check: X25519's field arithmetic, its
// conditional swap, its ladder and its encodings, held by tests/run.js to "no
// branch, no call it cannot follow, no secret-indexed access". Secret is the
// scalar bit (`swap`, `bit`) and every limb. The multiply, the swap and one
// ladder step compile to straight-line code (the module writes the multiply's
// ten rows out, so `clang -O2` unrolls each), and are read with no branch at
// all. The `loops` checks read the rolled loops whole, back edge included: the
// 255-step ladder (`ladderLoopScratch`), the inversion's square chains and the
// two encodings. Each loop's condition must be public, and nothing secret may
// index a load on any pass.
// ct-check: fieldMul secret=contents
// ct-check: fieldSquare secret=contents
// ct-check: fieldMulA24 secret=contents
// ct-check: fieldAdd secret=contents
// ct-check: fieldSub secret=contents
// ct-check: condSwap secret=bit,contents
// ct-check: ladderStepScratch secret=swap,contents
// ct-check: indexAfterMul secret=contents expect=load
// ct-check: fieldSquareTimes secret=contents loops
// ct-check: fieldPow250 secret=contents loops
// ct-check: fieldInvert secret=contents loops
// ct-check: fieldDecodeInto secret=contents loops
// ct-check: fieldEncodeInto secret=contents loops
// ct-check: ladderLoopScratch secret=contents loops
// ct-check: ladderLoopToTopBit secret=contents loops expect=branch
// ct-check: decodeThroughTable secret=bytes loops expect=load
// ct-check: fieldAddUnrolled secret=contents loops expect=noloop
//
// **These are copies, not imports.** A case compiles to one module, so the
// functions of `std/crypto/x25519.ts` are copied here, each under the name of
// the function it mirrors (`f25519X` as `fieldX`, `f25519Swap` as
// `condSwap`, `x25519LadderX` as `ladderX`). tests/run.js holds every copy
// to the module's text: it renames the module's functions so, drops the early
// `return` on a short array (it guards a public length, but it is a branch),
// drops comments and blank lines, writes `a[i]` as the `uncheckedGet` or
// `uncheckedSet` of `nish:unsafe` (a bounds check is a branch too), and
// requires the result. A module edit the copies miss fails there, not here.
//
// `main` runs the whole of X25519 on the copies, on RFC 7748's vectors, and
// ct_asm_x25519.out requires every answer.

import { uncheckedGet, uncheckedSet } from "nish:unsafe";

// ---- The copies ---------------------------------------------------------------

/** `f25519Add64`, `f25519Sub64` and `f25519Mul64`: limb arithmetic in `u64`, read back as `i64`. */
const fieldAdd64 = (a: i64, b: i64): i64 => toI64(toU64(a) + toU64(b))
const fieldSub64 = (a: i64, b: i64): i64 => toI64(toU64(a) - toU64(b))
const fieldMul64 = (a: i64, b: i64): i64 => toI64(toU64(a) * toU64(b))

/** `f25519Width`: 26 bits for an even limb, 25 for an odd one. */
const fieldWidth = (i: i32): i64 => {
  const odd: i64 = toI64(i & 1)
  return 26 - odd
}

/** `f25519LimbMask`. */
const fieldLimbMask = (i: i32): i64 => fieldSub64(toI64(1) << fieldWidth(i), toI64(1))

/** `f25519Copy`. */
const fieldCopy = (out: i64[], f: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(out, i, uncheckedGet(f, i));
  }
}

/** `f25519CarryChain`. */
const fieldCarryChain = (h: i64[]): void => {
  for (let i: i32 = 0; i < 9; i++) {
    const c: i64 = uncheckedGet(h, i) >> fieldWidth(i)
    uncheckedSet(h, i, uncheckedGet(h, i) & fieldLimbMask(i));
    uncheckedSet(h, i + 1, fieldAdd64(uncheckedGet(h, i + 1), c));
  }
}

/** `f25519Carry`. */
const fieldCarry = (h: i64[]): void => {
  fieldCarryChain(h)
  const top: i64 = uncheckedGet(h, 9) >> toI64(25)
  uncheckedSet(h, 9, uncheckedGet(h, 9) & fieldLimbMask(9));
  uncheckedSet(h, 0, fieldAdd64(uncheckedGet(h, 0), fieldMul64(top, toI64(19))));
  const c0: i64 = uncheckedGet(h, 0) >> toI64(26)
  uncheckedSet(h, 0, uncheckedGet(h, 0) & fieldLimbMask(0));
  uncheckedSet(h, 1, fieldAdd64(uncheckedGet(h, 1), c0));
}

/** `f25519Add`. */
export const fieldAdd = (out: i64[], f: i64[], g: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(out, i, fieldAdd64(uncheckedGet(f, i), uncheckedGet(g, i)));
  }
}

/** `f25519Sub`. */
export const fieldSub = (out: i64[], f: i64[], g: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(out, i, fieldSub64(uncheckedGet(f, i), uncheckedGet(g, i)));
  }
}

/** `f25519MulRow`: one row of the product. */
const fieldMulRow = (wide: i64[], f: i64[], doubled: i64[], g: i64[], i: i32): void => {
  for (let j: i32 = 0; j < 10; j++) {
    const k: i32 = i + j
    const fi: i64 = (i & j & 1) === 1 ? uncheckedGet(doubled, i) : uncheckedGet(f, i)
    if (k >= 0 && k < 19) {
      uncheckedSet(wide, k, fieldAdd64(uncheckedGet(wide, k), fieldMul64(fi, uncheckedGet(g, j))));
    }
  }
}

/** `f25519Mul`. */
export const fieldMul = (out: i64[], f: i64[], g: i64[]): void => {
  const doubled: i64[] = new Array<i64>(10)
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(doubled, i, fieldMul64(uncheckedGet(f, i), toI64((i & 1) + 1)));
  }
  const wide: i64[] = new Array<i64>(19)
  fieldMulRow(wide, f, doubled, g, 0)
  fieldMulRow(wide, f, doubled, g, 1)
  fieldMulRow(wide, f, doubled, g, 2)
  fieldMulRow(wide, f, doubled, g, 3)
  fieldMulRow(wide, f, doubled, g, 4)
  fieldMulRow(wide, f, doubled, g, 5)
  fieldMulRow(wide, f, doubled, g, 6)
  fieldMulRow(wide, f, doubled, g, 7)
  fieldMulRow(wide, f, doubled, g, 8)
  fieldMulRow(wide, f, doubled, g, 9)
  const h: i64[] = new Array<i64>(10)
  for (let k: i32 = 0; k < 9; k++) {
    uncheckedSet(h, k, fieldAdd64(uncheckedGet(wide, k), fieldMul64(uncheckedGet(wide, k + 10), toI64(19))));
  }
  uncheckedSet(h, 9, uncheckedGet(wide, 9));
  fieldCarry(h)
  fieldCopy(out, h)
}

/** `f25519Square`. */
export const fieldSquare = (out: i64[], f: i64[]): void => {
  fieldMul(out, f, f)
}

/** `f25519SquareTimes`. */
export const fieldSquareTimes = (out: i64[], f: i64[], n: i32): void => {
  fieldSquare(out, f)
  for (let i: i32 = 1; i < n; i++) {
    fieldSquare(out, out)
  }
}

/** `f25519MulA24`, with a24 = 121665. */
export const fieldMulA24 = (out: i64[], f: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(out, i, fieldMul64(uncheckedGet(f, i), toI64(121665)));
  }
  fieldCarry(out)
}

/** `f25519Pow250`: z^(2^250 - 1) and z^11. */
export const fieldPow250 = (out: i64[], z11: i64[], z: i64[]): void => {
  const z2: i64[] = new Array<i64>(10)
  const e2: i64[] = new Array<i64>(10)
  const e5: i64[] = new Array<i64>(10)
  const e10: i64[] = new Array<i64>(10)
  const e50: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  fieldSquare(z2, z)
  fieldMul(e2, z2, z)
  fieldSquareTimes(t, z2, 2)
  fieldMul(z11, t, e2)
  fieldSquareTimes(t, e2, 2)
  fieldMul(t, t, e2)
  fieldSquare(t, t)
  fieldMul(e5, t, z)
  fieldSquareTimes(t, e5, 5)
  fieldMul(e10, t, e5)
  fieldSquareTimes(t, e10, 10)
  fieldMul(out, t, e10)
  fieldSquareTimes(t, out, 20)
  fieldMul(out, t, out)
  fieldSquareTimes(t, out, 10)
  fieldMul(e50, t, e10)
  fieldSquareTimes(t, e50, 50)
  fieldMul(out, t, e50)
  fieldSquareTimes(t, out, 100)
  fieldMul(out, t, out)
  fieldSquareTimes(t, out, 50)
  fieldMul(out, t, e50)
}

/** `f25519Invert`: z^(p - 2). */
export const fieldInvert = (out: i64[], z: i64[]): void => {
  const z11: i64[] = new Array<i64>(10)
  const acc: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  fieldPow250(acc, z11, z)
  fieldSquareTimes(t, acc, 5)
  fieldMul(out, t, z11)
}

/** `f25519Swap`: the masked xor, the same instructions for either bit. */
export const condSwap = (f: i64[], g: i64[], bit: i64): void => {
  const mask: i64 = fieldSub64(toI64(0), bit)
  for (let i: i32 = 0; i < 10; i++) {
    const t: i64 = mask & (uncheckedGet(f, i) ^ uncheckedGet(g, i))
    uncheckedSet(f, i, uncheckedGet(f, i) ^ t);
    uncheckedSet(g, i, uncheckedGet(g, i) ^ t);
  }
}

/** `f25519DecodeInto`: the decode's loop. */
export const fieldDecodeInto = (f: i64[], bytes: u8[]): void => {
  let acc: i64 = 0
  let bits: i64 = 0
  let limb: i32 = 0
  for (let i: i32 = 0; i < 32; i++) {
    let b: i64 = toI64(uncheckedGet(bytes, i))
    if (i === 31) {
      b = b & toI64(0x7f)
    }
    acc = acc | (b << bits)
    bits = bits + toI64(8)
    if (limb >= 0 && limb < 10) {
      const width: i64 = fieldWidth(limb)
      if (bits >= width) {
        uncheckedSet(f, limb, acc & fieldLimbMask(limb));
        acc = acc >> width
        bits = bits - width
        limb = limb + 1
      }
    }
  }
}

/** `f25519Decode`. */
const fieldDecode = (bytes: u8[]): i64[] => {
  const f: i64[] = new Array<i64>(10)
  fieldDecodeInto(f, bytes)
  return f
}

/** `f25519EncodeInto`: the encode's reduction and packing. */
export const fieldEncodeInto = (out: u8[], f: i64[]): void => {
  const h: i64[] = new Array<i64>(10)
  fieldCopy(h, f)
  fieldCarry(h)
  fieldCarry(h)
  let q: i64 = fieldAdd64(uncheckedGet(h, 0), toI64(19)) >> toI64(26)
  for (let i: i32 = 1; i < 10; i++) {
    q = fieldAdd64(uncheckedGet(h, i), q) >> fieldWidth(i)
  }
  uncheckedSet(h, 0, fieldAdd64(uncheckedGet(h, 0), fieldMul64(q, toI64(19))));
  fieldCarryChain(h)
  uncheckedSet(h, 9, uncheckedGet(h, 9) & fieldLimbMask(9));
  let acc: i64 = 0
  let bits: i64 = 0
  let at: i32 = 0
  for (let i: i32 = 0; i < 10; i++) {
    acc = acc | (uncheckedGet(h, i) << bits)
    bits = bits + fieldWidth(i)
    while (bits >= toI64(8) && at >= 0 && at < 32) {
      uncheckedSet(out, at, toU8(acc & toI64(0xff)));
      acc = acc >> toI64(8)
      bits = bits - toI64(8)
      at = at + 1
    }
  }
  if (at >= 0 && at < 32) {
    uncheckedSet(out, at, toU8(acc & toI64(0xff)));
  }
}

/** `f25519Encode`. */
const fieldEncode = (f: i64[]): u8[] => {
  const out: u8[] = new Array<u8>(32)
  fieldEncodeInto(out, f)
  return out
}

/** `x25519LadderStep`: one step, from its two swaps on. */
const ladderStep = (
  x2: i64[],
  z2: i64[],
  x3: i64[],
  z3: i64[],
  u: i64[],
  swap: i64,
  a: i64[],
  aa: i64[],
  b: i64[],
  bb: i64[],
  e: i64[],
  c: i64[],
  d: i64[],
  da: i64[],
  cb: i64[],
  t: i64[]
): void => {
  condSwap(x2, x3, swap)
  condSwap(z2, z3, swap)
  fieldAdd(a, x2, z2)
  fieldSquare(aa, a)
  fieldSub(b, x2, z2)
  fieldSquare(bb, b)
  fieldSub(e, aa, bb)
  fieldAdd(c, x3, z3)
  fieldSub(d, x3, z3)
  fieldMul(da, d, a)
  fieldMul(cb, c, b)
  fieldAdd(t, da, cb)
  fieldSquare(x3, t)
  fieldSub(t, da, cb)
  fieldSquare(t, t)
  fieldMul(z3, u, t)
  fieldMul(x2, aa, bb)
  fieldMulA24(t, e)
  fieldAdd(t, aa, t)
  fieldMul(z2, e, t)
}

/** `x25519LadderLoop`: the 255 steps and the two swaps after them. */
const ladderLoop = (
  x2: i64[],
  z2: i64[],
  x3: i64[],
  z3: i64[],
  u: i64[],
  k: u8[],
  a: i64[],
  aa: i64[],
  b: i64[],
  bb: i64[],
  e: i64[],
  c: i64[],
  d: i64[],
  da: i64[],
  cb: i64[],
  t: i64[]
): void => {
  let swap: i64 = 0
  for (let byte: i32 = 31; byte >= 0; byte--) {
    for (let shift: i32 = 7; shift >= 0; shift--) {
      if (byte === 31 && shift === 7) {
        continue
      }
      const bit: i64 = toI64(uncheckedGet(k, byte) >> toU8(shift)) & toI64(1)
      swap = swap ^ bit
      ladderStep(x2, z2, x3, z3, u, swap, a, aa, b, bb, e, c, d, da, cb, t)
      swap = bit
    }
  }
  condSwap(x2, x3, swap)
  condSwap(z2, z3, swap)
}

// ---- The checked ladder ---------------------------------------------------------
// `ladderStep` and `ladderLoop` take their scratch as ten more arrays, past the
// six parameters the check can place in registers, so these call them on
// scratch of their own stack, as `x25519Ladder` does. The check follows the call.

export const ladderStepScratch = (x2: i64[], z2: i64[], x3: i64[], z3: i64[], u: i64[], swap: i64): void => {
  const a: i64[] = new Array<i64>(10)
  const aa: i64[] = new Array<i64>(10)
  const b: i64[] = new Array<i64>(10)
  const bb: i64[] = new Array<i64>(10)
  const e: i64[] = new Array<i64>(10)
  const c: i64[] = new Array<i64>(10)
  const d: i64[] = new Array<i64>(10)
  const da: i64[] = new Array<i64>(10)
  const cb: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  ladderStep(x2, z2, x3, z3, u, swap, a, aa, b, bb, e, c, d, da, cb, t)
}

export const ladderLoopScratch = (x2: i64[], z2: i64[], x3: i64[], z3: i64[], u: i64[], k: u8[]): void => {
  const a: i64[] = new Array<i64>(10)
  const aa: i64[] = new Array<i64>(10)
  const b: i64[] = new Array<i64>(10)
  const bb: i64[] = new Array<i64>(10)
  const e: i64[] = new Array<i64>(10)
  const c: i64[] = new Array<i64>(10)
  const d: i64[] = new Array<i64>(10)
  const da: i64[] = new Array<i64>(10)
  const cb: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  ladderLoop(x2, z2, x3, z3, u, k, a, aa, b, bb, e, c, d, da, cb, t)
}

// ---- Written to fail --------------------------------------------------------

// A multiply into an array on this function's own stack, then a table read at
// a limb of the product. The check follows the call into `fieldMul`, and must
// know afterwards that the limb it wrote is secret.
export const indexAfterMul = (f: i64[], g: i64[], table: i64[]): i64 => {
  const h: i64[] = new Array<i64>(10)
  fieldMul(h, f, g)
  return uncheckedGet(table, toI32(uncheckedGet(h, 0) & toI64(7)))
}

// A ladder whose loop stops at the scalar's highest set bit: the loop runs a
// secret number of times, and its back edge tests a secret.
export const ladderLoopToTopBit = (x2: i64[], z2: i64[], x3: i64[], z3: i64[], u: i64[], k: u8[]): void => {
  const a: i64[] = new Array<i64>(10)
  const aa: i64[] = new Array<i64>(10)
  const b: i64[] = new Array<i64>(10)
  const bb: i64[] = new Array<i64>(10)
  const e: i64[] = new Array<i64>(10)
  const c: i64[] = new Array<i64>(10)
  const d: i64[] = new Array<i64>(10)
  const da: i64[] = new Array<i64>(10)
  const cb: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  let top: i32 = 254
  while (top > 0 && ((uncheckedGet(k, top >> 3) >> toU8(top & 7)) & toU8(1)) === toU8(0)) {
    top = top - 1
  }
  let swap: i64 = 0
  for (let at: i32 = top; at >= 0; at--) {
    const bit: i64 = toI64(uncheckedGet(k, at >> 3) >> toU8(at & 7)) & toI64(1)
    swap = swap ^ bit
    ladderStep(x2, z2, x3, z3, u, swap, a, aa, b, bb, e, c, d, da, cb, t)
    swap = bit
  }
}

// A decode that carries a secret round its loop and then reads a table at it:
// a single walk in order reads the index at the loop's head as the public zero
// it starts as, and only the back edge brings the byte round.
export const decodeThroughTable = (f: i64[], bytes: u8[], table: i64[]): void => {
  let acc: i64 = 0
  for (let i: i32 = 0; i < 10; i++) {
    uncheckedSet(f, i, uncheckedGet(table, toI32(acc & toI64(7))));
    acc = toI64(uncheckedGet(bytes, i))
  }
}

// A field add checked as a loop: clang unrolls its ten limbs, so there is no
// loop left to read, and a `loops` check of it must say so rather than pass.
export const fieldAddUnrolled = (out: i64[], f: i64[], g: i64[]): void => {
  fieldAdd(out, f, g)
}

// ---- X25519 on the copies, for main ---------------------------------------------

/** `x25519` and `x25519Ladder`: clamp a copy, then `ladderLoop`, as the module does. */
const ladder = (scalar: u8[], uBytes: u8[]): u8[] => {
  const k: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    uncheckedSet(k, i, uncheckedGet(scalar, i));
  }
  uncheckedSet(k, 0, uncheckedGet(k, 0) & toU8(248));
  uncheckedSet(k, 31, (uncheckedGet(k, 31) & toU8(127)) | toU8(64));
  const u: i64[] = fieldDecode(uBytes)
  const x2: i64[] = new Array<i64>(10)
  uncheckedSet(x2, 0, toI64(1));
  const z2: i64[] = new Array<i64>(10)
  const x3: i64[] = new Array<i64>(10)
  fieldCopy(x3, u)
  const z3: i64[] = new Array<i64>(10)
  uncheckedSet(z3, 0, toI64(1));
  const a: i64[] = new Array<i64>(10)
  const aa: i64[] = new Array<i64>(10)
  const b: i64[] = new Array<i64>(10)
  const bb: i64[] = new Array<i64>(10)
  const e: i64[] = new Array<i64>(10)
  const c: i64[] = new Array<i64>(10)
  const d: i64[] = new Array<i64>(10)
  const da: i64[] = new Array<i64>(10)
  const cb: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  ladderLoop(x2, z2, x3, z3, u, k, a, aa, b, bb, e, c, d, da, cb, t)
  fieldInvert(t, z2)
  fieldMul(x2, x2, t)
  return fieldEncode(x2)
}

const HEX_DIGITS: string = "0123456789abcdef"

const hexNibble = (code: i32): i32 => (code <= 57 ? code - 48 : code - 87)

const fromHex = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    const high: i32 = hexNibble(toI32(text.charCodeAt(2 * i)))
    const low: i32 = hexNibble(toI32(text.charCodeAt(2 * i + 1)))
    uncheckedSet(out, i, toU8(high * 16 + low));
  }
  return out
}

const toHex = (bytes: u8[] | null): string => {
  if (bytes === null) {
    return "null"
  }
  const digits: string[] = []
  for (let i: i32 = 0; i < 32; i++) {
    const v: i32 = toI32(uncheckedGet(bytes, i))
    digits.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1))
    digits.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1))
  }
  return digits.join("")
}

/** One RFC vector on the copies: prints `ok` or what they answered instead. */
const check = (label: string, got: string, want: string): i32 => {
  if (got === want) {
    console.log(`ok    ${label}`)
    return 0
  }
  console.log(`FAIL  ${label}: ${got}`)
  return 1
}

/** RFC 7748 §5.2's iterated vector on the copies: k = u = 9, then (k, u) = (X25519(k, u), k). */
const iterate = (times: i32): string => {
  let k: u8[] = new Array<u8>(32)
  uncheckedSet(k, 0, toU8(9));
  let u: u8[] = new Array<u8>(32)
  uncheckedSet(u, 0, toU8(9));
  for (let i: i32 = 0; i < times; i++) {
    const next: u8[] = ladder(k, u)
    u = k
    k = next
  }
  return toHex(k)
}

export const main = (): i32 => {
  let failed: i32 = 0
  failed =
    failed +
    check(
      "RFC 7748 §5.2 first vector",
      toHex(
        ladder(
          fromHex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4"),
          fromHex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c")
        )
      ),
      "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552"
    )
  failed =
    failed +
    check(
      "RFC 7748 §5.2 second vector",
      toHex(
        ladder(
          fromHex("4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d"),
          fromHex("e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493")
        )
      ),
      "95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957"
    )
  failed =
    failed +
    check(
      "RFC 7748 §6.1 Alice's public key",
      toHex(
        ladder(
          fromHex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a"),
          fromHex("0900000000000000000000000000000000000000000000000000000000000000")
        )
      ),
      "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
    )
  failed =
    failed +
    check(
      "RFC 7748 §5.2 iterated 1,000 times",
      iterate(1000),
      "684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51"
    )
  return failed
}
