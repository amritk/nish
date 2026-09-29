// WP34 K4 under the N6 assembly check: X25519's field multiply, its
// conditional swap and one step of its Montgomery ladder, held by
// tests/run.js to "no branch, no call it cannot follow, no secret-indexed
// access". Secret is the scalar bit (`swap`, `bit`) and every limb.
// ct-check: fieldMul secret=contents
// ct-check: fieldSquare secret=contents
// ct-check: fieldMulA24 secret=contents
// ct-check: fieldAdd secret=contents
// ct-check: fieldSub secret=contents
// ct-check: condSwap secret=bit,contents
// ct-check: ladderStep secret=swap,contents
// ct-check: indexAfterMul secret=contents expect=load
//
// **These are copies, not imports.** `std/crypto/x25519.ts` exports only
// `x25519` and `x25519Base`, whose 255-step loop the check refuses by
// design, so its cores are copied here, each under the name of the function
// it mirrors. Two things differ, and neither changes a value:
//
// - The early `return` on a short array is gone. It guards a public length,
//   but it is a branch, and the check refuses every branch.
// - `fieldMul` writes the ten rows of `f25519Mul`'s outer loop out by hand,
//   calling `fieldMulRow` once per row. `clang -O2` unrolls the inner loop
//   and leaves the outer one rolled, and a rolled loop is a back-edge.
//
// `main` is what keeps the copies honest: it runs the whole of X25519 on
// them, on RFC 7748's vectors, and ct_asm_x25519.out requires every answer.
// tests/link/crypto_x25519 holds the module to the same vectors, so the two
// agree through the RFC. (A case here compiles to one `.ll`, so it cannot
// import a `std/` module and compare with it directly.)

// ---- The copies ---------------------------------------------------------------

/** `f25519Width`: 26 bits for an even limb, 25 for an odd one. */
const fieldWidth = (i: i32): i64 => {
  const odd: i64 = toI64(i & 1)
  return 26 - odd
}

/** `f25519LimbMask`. */
const fieldLimbMask = (i: i32): i64 => (toI64(1) << fieldWidth(i)) - toI64(1)

/** `f25519Copy`. */
const fieldCopy = (out: i64[], f: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i]
  }
}

/** `f25519CarryChain`. */
const fieldCarryChain = (h: i64[]): void => {
  for (let i: i32 = 0; i < 9; i++) {
    const c: i64 = h[i] >> fieldWidth(i)
    h[i] = h[i] & fieldLimbMask(i)
    h[i + 1] = h[i + 1] + c
  }
}

/** `f25519Carry`. */
const fieldCarry = (h: i64[]): void => {
  fieldCarryChain(h)
  const top: i64 = h[9] >> toI64(25)
  h[9] = h[9] & fieldLimbMask(9)
  h[0] = h[0] + top * toI64(19)
  const c0: i64 = h[0] >> toI64(26)
  h[0] = h[0] & fieldLimbMask(0)
  h[1] = h[1] + c0
}

/** `f25519Add`. */
export const fieldAdd = (out: i64[], f: i64[], g: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] + g[i]
  }
}

/** `f25519Sub`. */
export const fieldSub = (out: i64[], f: i64[], g: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] - g[i]
  }
}

/** Row `i` of `f25519Mul`'s product loop: the body of its outer `for`. */
const fieldMulRow = (wide: i64[], f: i64[], doubled: i64[], g: i64[], i: i32): void => {
  for (let j: i32 = 0; j < 10; j++) {
    const k: i32 = i + j
    const fi: i64 = (i & j & 1) === 1 ? doubled[i] : f[i]
    if (k >= 0 && k < 19) {
      wide[k] = wide[k] + fi * g[j]
    }
  }
}

/** `f25519Mul`, its outer loop written out a row at a time. */
export const fieldMul = (out: i64[], f: i64[], g: i64[]): void => {
  const doubled: i64[] = new Array<i64>(10)
  for (let i: i32 = 0; i < 10; i++) {
    doubled[i] = f[i] * toI64((i & 1) + 1)
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
    h[k] = wide[k] + wide[k + 10] * toI64(19)
  }
  h[9] = wide[9]
  fieldCarry(h)
  fieldCopy(out, h)
}

/** `f25519Square`. */
export const fieldSquare = (out: i64[], f: i64[]): void => {
  fieldMul(out, f, f)
}

/** `f25519MulA24`, with a24 = 121665. */
export const fieldMulA24 = (out: i64[], f: i64[]): void => {
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] * toI64(121665)
  }
  fieldCarry(out)
}

/** `f25519Swap`: the masked xor, the same instructions for either bit. */
export const condSwap = (f: i64[], g: i64[], bit: i64): void => {
  const mask: i64 = toI64(0) - bit
  for (let i: i32 = 0; i < 10; i++) {
    const t: i64 = mask & (f[i] ^ g[i])
    f[i] = f[i] ^ t
    g[i] = g[i] ^ t
  }
}

/**
 * One pass of `x25519Ladder`'s inner loop, from the two swaps on: `swap` is
 * the bit the loop has just folded into its swap state. The bit itself is
 * read in `ladder` below, at a public position, and only ever feeds a mask.
 */
export const ladderStep = (x2: i64[], z2: i64[], x3: i64[], z3: i64[], u: i64[], swap: i64): void => {
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

// ---- Written to fail --------------------------------------------------------

// A multiply into an array on this function's own stack, then a table read at
// a limb of the product. The check follows the call into `fieldMul`, and must
// know afterwards that the limb it wrote is secret.
export const indexAfterMul = (f: i64[], g: i64[], table: i64[]): i64 => {
  const h: i64[] = new Array<i64>(10)
  fieldMul(h, f, g)
  return table[toI32(h[0] & toI64(7))]
}

// ---- X25519 on the copies, for main ---------------------------------------------

/** `f25519Decode`. */
const fieldDecode = (bytes: u8[]): i64[] => {
  const f: i64[] = new Array<i64>(10)
  let acc: i64 = 0
  let bits: i64 = 0
  let limb: i32 = 0
  for (let i: i32 = 0; i < 32; i++) {
    let v: i64 = toI64(bytes[i])
    if (i === 31) {
      v = v & toI64(0x7f)
    }
    acc = acc | (v << bits)
    bits = bits + toI64(8)
    if (limb >= 0 && limb < 10) {
      const width: i64 = fieldWidth(limb)
      if (bits >= width) {
        f[limb] = acc & fieldLimbMask(limb)
        acc = acc >> width
        bits = bits - width
        limb = limb + 1
      }
    }
  }
  return f
}

/** `f25519Encode`. */
const fieldEncode = (f: i64[]): u8[] => {
  const h: i64[] = new Array<i64>(10)
  fieldCopy(h, f)
  fieldCarry(h)
  fieldCarry(h)
  let q: i64 = (h[0] + toI64(19)) >> toI64(26)
  for (let i: i32 = 1; i < 10; i++) {
    q = (h[i] + q) >> fieldWidth(i)
  }
  h[0] = h[0] + q * toI64(19)
  fieldCarryChain(h)
  h[9] = h[9] & fieldLimbMask(9)
  const out: u8[] = new Array<u8>(32)
  let acc: i64 = 0
  let bits: i64 = 0
  let at: i32 = 0
  for (let i: i32 = 0; i < 10; i++) {
    acc = acc | (h[i] << bits)
    bits = bits + fieldWidth(i)
    while (bits >= toI64(8) && at >= 0 && at < 32) {
      out[at] = toU8(acc & toI64(0xff))
      acc = acc >> toI64(8)
      bits = bits - toI64(8)
      at = at + 1
    }
  }
  if (at >= 0 && at < 32) {
    out[at] = toU8(acc & toI64(0xff))
  }
  return out
}

/** `f25519SquareTimes`. */
const fieldSquareTimes = (out: i64[], f: i64[], n: i32): void => {
  fieldSquare(out, f)
  for (let i: i32 = 1; i < n; i++) {
    fieldSquare(out, out)
  }
}

/** `f25519Invert`: z^(p - 2), the same chain. */
const fieldInvert = (out: i64[], z: i64[]): void => {
  const z2: i64[] = new Array<i64>(10)
  const z11: i64[] = new Array<i64>(10)
  const e2: i64[] = new Array<i64>(10)
  const e5: i64[] = new Array<i64>(10)
  const e10: i64[] = new Array<i64>(10)
  const e50: i64[] = new Array<i64>(10)
  const t: i64[] = new Array<i64>(10)
  const acc: i64[] = new Array<i64>(10)
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
  fieldMul(acc, t, e10)
  fieldSquareTimes(t, acc, 20)
  fieldMul(acc, t, acc)
  fieldSquareTimes(t, acc, 10)
  fieldMul(e50, t, e10)
  fieldSquareTimes(t, e50, 50)
  fieldMul(acc, t, e50)
  fieldSquareTimes(t, acc, 100)
  fieldMul(acc, t, acc)
  fieldSquareTimes(t, acc, 50)
  fieldMul(acc, t, e50)
  fieldSquareTimes(t, acc, 5)
  fieldMul(out, t, z11)
}

/** `x25519` and `x25519Ladder`: clamp a copy, then 255 `ladderStep`s, as the module does. */
const ladder = (scalar: u8[], uBytes: u8[]): u8[] => {
  const k: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    k[i] = scalar[i]
  }
  k[0] = k[0] & toU8(248)
  k[31] = (k[31] & toU8(127)) | toU8(64)
  const u: i64[] = fieldDecode(uBytes)
  const x2: i64[] = new Array<i64>(10)
  x2[0] = toI64(1)
  const z2: i64[] = new Array<i64>(10)
  const x3: i64[] = new Array<i64>(10)
  fieldCopy(x3, u)
  const z3: i64[] = new Array<i64>(10)
  z3[0] = toI64(1)
  let swap: i64 = 0
  for (let byte: i32 = 31; byte >= 0; byte--) {
    for (let shift: i32 = 7; shift >= 0; shift--) {
      if (byte === 31 && shift === 7) {
        continue
      }
      const bit: i64 = toI64(k[byte] >> toU8(shift)) & toI64(1)
      swap = swap ^ bit
      ladderStep(x2, z2, x3, z3, u, swap)
      swap = bit
    }
  }
  condSwap(x2, x3, swap)
  condSwap(z2, z3, swap)
  const t: i64[] = new Array<i64>(10)
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
    out[i] = toU8(high * 16 + low)
  }
  return out
}

const toHex = (bytes: u8[] | null): string => {
  if (bytes === null) {
    return "null"
  }
  const digits: string[] = []
  for (let i: i32 = 0; i < 32; i++) {
    const v: i32 = toI32(bytes[i])
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
  k[0] = toU8(9)
  let u: u8[] = new Array<u8>(32)
  u[0] = toU8(9)
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
