/**
 * `nish/crypto/x25519` — the X25519 Diffie-Hellman function of RFC 7748.
 *
 * Written from the specification (RFC 7748 §4.1, §5 and §6.1), in this
 * module's own structure: nothing here is ported from another implementation.
 * The radix-2^25.5 limbs and the shape of the inversion chain are the ideas
 * D. J. Bernstein's "Curve25519: new Diffie-Hellman speed records" (PKC 2006)
 * describes; the code is this module's.
 *
 * **The field.** An element of GF(p), p = 2^255 - 19, is ten signed limbs in
 * `i64`, alternately 26 and 25 bits wide, so limb `i` sits at bit
 * `ceil(25.5 * i)` (0, 26, 51, 77, …, 230) and the ten of them span exactly
 * 255 bits. Two things make that layout pay:
 *
 * - The product of the limbs at `i` and `j` lands exactly on the limb at
 *   `i + j`, except when both are odd, where it lands one bit above and is
 *   doubled to make up for it. A product that runs past limb 9 wraps to limb
 *   `i + j - 10` times 19, because 2^255 = 19 (mod p). So a multiplication is
 *   a hundred `i64` products and no wide arithmetic.
 * - The limbs are signed, and `>>` on an `i64` is an arithmetic shift, so a
 *   subtraction needs no bias and a carry is a floor division that works the
 *   same on a negative limb.
 *
 * Signed `i64` overflow is undefined behaviour in this language unless a
 * program is compiled with `--wrapping`, so the limb bounds below are not a
 * nicety: each function states what it accepts and what it answers, and
 * `f25519Mul` says why its sums fit.
 *
 * **Constant time, by construction, and in part by disassembly.** Nothing
 * branches on, or indexes by, a secret: the ladder swaps with a mask and runs
 * all 255 steps whatever the scalar, and the final reduction subtracts p by
 * adding a carry bit times 19 rather than by comparing. Every `if` and every
 * loop bound here is on a public quantity — a limb number, a bit position or
 * an input length.
 *
 * WP34 N6's disassembly check (`tests/ct-asm.js`) verifies the part a secret
 * flows through: `tests/cases/ct_asm_x25519` holds copies of `f25519Mul`,
 * `f25519Square`, `f25519MulA24`, `f25519Add`, `f25519Sub`, `f25519Swap` and
 * one pass of `x25519Ladder`'s loop, and the check reads each one's `clang -O2`
 * machine code for x86-64 and aarch64 and finds no branch and no load or store
 * at an address the scalar bit or a limb reaches. They are copies because the
 * check refuses every branch, loop back-edges included, and this module's own
 * functions keep their loops and the early `return`s below; the copies drop the
 * guards and write `f25519Mul`'s outer loop out a row at a time, and the
 * fixture's `main` holds them to the same RFC 7748 vectors as this module. A
 * change to one of those functions belongs in that fixture too. What stays
 * discipline rather than proof is the rest: the loops around the step,
 * `f25519Decode`, `f25519Encode` and `f25519Invert`, whose branches are all on
 * public positions. Weekly, `tests/ct-timing.js` times the fixture's functions
 * on real x86-64 and aarch64 hardware as well.
 *
 * **Loop bounds are literals.** A field element is always ten limbs and an
 * encoding always 32 bytes, and each function that indexes one opens with an
 * early `return` for a shorter array. That cannot happen — every element is
 * made here, and `x25519` checks its arguments' lengths before anything else
 * — but it is what lets the compiler prove the loops after it, which count to
 * the literal `10` or `32`, in range and drop their bounds checks. (A named
 * constant as the bound, or a `panic` as the guard, does not prove them.)
 *
 * Private names carry the `f25519` / `x25519` prefix because a `std/` module's
 * private functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */

/** The length in bytes of a scalar, a u-coordinate and an X25519 output. */
export const X25519_SIZE: i32 = 32

/** (A - 2) / 4 for curve25519's A = 486662 (RFC 7748 §5). */
const X25519_A24: i64 = 121665

/** The width of limb `i`: 26 bits for an even limb, 25 for an odd one. */
const f25519Width = (i: i32): i64 => {
  const odd: i64 = toI64(i & 1)
  return 26 - odd
}

/** The mask of limb `i`'s bits, `2^width - 1`. */
const f25519LimbMask = (i: i32): i64 => (toI64(1) << f25519Width(i)) - toI64(1)

/** A fresh field element, zero. */
const f25519Zero = (): i64[] => {
  const f: i64[] = new Array<i64>(10)
  return f
}

/** A fresh field element holding the small constant `n`. */
const f25519Small = (n: i64): i64[] => {
  const f: i64[] = f25519Zero()
  f[0] = n
  return f
}

/** `out = f`, limb by limb. */
const f25519Copy = (out: i64[], f: i64[]): void => {
  if (toI32(out.length) < 10 || toI32(f.length) < 10) {
    return
  }
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i]
  }
}

/**
 * Carries limbs 0 to 8 each into the next, leaving limb 9 as it is: the part
 * of a carry that `f25519Carry` and `f25519Encode` share, and the two differ
 * only in what they do with limb 9's overflow.
 */
const f25519CarryChain = (h: i64[]): void => {
  if (toI32(h.length) < 10) {
    return
  }
  for (let i: i32 = 0; i < 9; i++) {
    const c: i64 = h[i] >> f25519Width(i)
    h[i] = h[i] & f25519LimbMask(i)
    h[i + 1] = h[i + 1] + c
  }
}

/**
 * Carries every limb into the next, folding the carry out of limb 9 back into
 * limb 0 times 19, and then carries limb 0 once more.
 *
 * Accepts limbs of magnitude below 2^63 minus the carries they receive — in
 * practice below 2^62.6, which is what `f25519Mul` produces. The carry out of
 * a limb that large is below 2^37.6, the fold is below 2^42, so no sum along
 * the chain overflows. Answers a **reduced** element: limbs 0 and 2–9 in
 * `[0, 2^width)`, and limb 1 in that range plus the final carry out of limb 0,
 * which is at most 2^17 either way. So every limb of a reduced element has
 * magnitude below 2^26.
 *
 * Each carry is `h >> width` (arithmetic, so a floor) and each remainder is
 * `h & (2^width - 1)`, which is the matching non-negative remainder for a
 * negative limb too, without shifting a negative number left.
 */
const f25519Carry = (h: i64[]): void => {
  if (toI32(h.length) < 10) {
    return
  }
  f25519CarryChain(h)
  const top: i64 = h[9] >> toI64(25)
  h[9] = h[9] & f25519LimbMask(9)
  h[0] = h[0] + top * toI64(19)
  const c0: i64 = h[0] >> toI64(26)
  h[0] = h[0] & f25519LimbMask(0)
  h[1] = h[1] + c0
}

/**
 * `out = f + g`, not carried. With both reduced (limbs below 2^26 in
 * magnitude) the sum's limbs are below 2^27, which `f25519Mul` accepts.
 */
const f25519Add = (out: i64[], f: i64[], g: i64[]): void => {
  if (toI32(out.length) < 10 || toI32(f.length) < 10 || toI32(g.length) < 10) {
    return
  }
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] + g[i]
  }
}

/**
 * `out = f - g`, not carried. Signed limbs need no bias to stay positive; with
 * both reduced the difference's limbs are below 2^27 in magnitude, which
 * `f25519Mul` accepts.
 */
const f25519Sub = (out: i64[], f: i64[], g: i64[]): void => {
  if (toI32(out.length) < 10 || toI32(f.length) < 10 || toI32(g.length) < 10) {
    return
  }
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] - g[i]
  }
}

/**
 * `out = f * g`, reduced. `out` may be `f` or `g`: the product is built in
 * scratch arrays and only copied out at the end.
 *
 * **Why the sums fit in `i64`.** Accepts limbs below 2^27 in magnitude — a
 * reduced element, or the sum or difference of two reduced elements. Output
 * limb `k` collects exactly ten products `f[i] * g[j]` with
 * `i + j = k (mod 10)`, each scaled by at most 2 (both indices odd) times 19
 * (the product wrapped past limb 9). So each term is below 38 * 2^54 and each
 * sum below 380 * 2^54 < 2^62.6, under 2^63 with room for the carries
 * `f25519Carry` adds on top; the partial sums in `wide` are parts of those
 * same sums, and `wide[k + 10] * 19` is below 18 * 19 * 2^54 < 2^58.5 on its
 * own, so no intermediate is larger. Giving `f25519Mul` anything wider — two unreduced
 * sums added again, say — breaks this bound, which is why every caller carries
 * or multiplies before it adds a second time.
 */
const f25519Mul = (out: i64[], f: i64[], g: i64[]): void => {
  if (toI32(f.length) < 10 || toI32(g.length) < 10) {
    return
  }
  // Two odd limbs meet one bit above their target limb, so an odd-by-odd
  // product takes `f`'s limb doubled.
  const doubled: i64[] = new Array<i64>(10)
  for (let i: i32 = 0; i < 10; i++) {
    doubled[i] = f[i] * toI64((i & 1) + 1)
  }
  // The plain product, limb `i + j` of nineteen.
  const wide: i64[] = new Array<i64>(19)
  for (let i: i32 = 0; i < 10; i++) {
    for (let j: i32 = 0; j < 10; j++) {
      const k: i32 = i + j
      const fi: i64 = (i & j & 1) === 1 ? doubled[i] : f[i]
      if (k >= 0 && k < 19) {
        wide[k] = wide[k] + fi * g[j]
      }
    }
  }
  // Limbs 10 to 18 are past bit 255, and 2^255 = 19 (mod p): fold them down.
  const h: i64[] = new Array<i64>(10)
  for (let k: i32 = 0; k < 9; k++) {
    h[k] = wide[k] + wide[k + 10] * toI64(19)
  }
  h[9] = wide[9]
  f25519Carry(h)
  f25519Copy(out, h)
}

/** `out = f * f`, reduced; the same bounds as `f25519Mul`. */
const f25519Square = (out: i64[], f: i64[]): void => {
  f25519Mul(out, f, f)
}

/** `out = f` squared `n` times in a row (`n` at least 1), reduced. */
const f25519SquareTimes = (out: i64[], f: i64[], n: i32): void => {
  f25519Square(out, f)
  for (let i: i32 = 1; i < n; i++) {
    f25519Square(out, out)
  }
}

/**
 * `out = f * a24`, reduced. Accepts limbs below 2^27 in magnitude; times
 * 121665 (under 2^17) each is below 2^44, far inside what `f25519Carry`
 * accepts.
 */
const f25519MulA24 = (out: i64[], f: i64[]): void => {
  if (toI32(out.length) < 10 || toI32(f.length) < 10) {
    return
  }
  for (let i: i32 = 0; i < 10; i++) {
    out[i] = f[i] * X25519_A24
  }
  f25519Carry(out)
}

/**
 * `out = z^(p - 2)`, which is `1 / z` by Fermat's little theorem, and zero for
 * a zero `z` — what RFC 7748 §5 asks of the ladder's last step.
 *
 * p - 2 = 2^255 - 21 = (2^250 - 1) * 2^5 + 11, so the exponent is 250 ones
 * followed by `01011`. The chain builds `z^(2^n - 1)` for n = 2, 4, 5, 10, 20,
 * 40, 50, 100, 200 and 250 from the rule
 * `z^(2^(a+b) - 1) = (z^(2^a - 1))^(2^b) * z^(2^b - 1)`, then squares five
 * times and multiplies by `z^11`: 254 squarings and 11 multiplications, the
 * same for every `z`.
 */
const f25519Invert = (out: i64[], z: i64[]): void => {
  const z2: i64[] = f25519Zero()
  const z11: i64[] = f25519Zero()
  const e2: i64[] = f25519Zero()
  const e5: i64[] = f25519Zero()
  const e10: i64[] = f25519Zero()
  const e50: i64[] = f25519Zero()
  const t: i64[] = f25519Zero()
  const acc: i64[] = f25519Zero()

  f25519Square(z2, z)
  f25519Mul(e2, z2, z) // z^3 = z^(2^2 - 1)
  f25519SquareTimes(t, z2, 2) // z^8
  f25519Mul(z11, t, e2)

  f25519SquareTimes(t, e2, 2)
  f25519Mul(t, t, e2) // 2^4 - 1
  f25519Square(t, t)
  f25519Mul(e5, t, z) // 2^5 - 1
  f25519SquareTimes(t, e5, 5)
  f25519Mul(e10, t, e5) // 2^10 - 1
  f25519SquareTimes(t, e10, 10)
  f25519Mul(acc, t, e10) // 2^20 - 1
  f25519SquareTimes(t, acc, 20)
  f25519Mul(acc, t, acc) // 2^40 - 1
  f25519SquareTimes(t, acc, 10)
  f25519Mul(e50, t, e10) // 2^50 - 1
  f25519SquareTimes(t, e50, 50)
  f25519Mul(acc, t, e50) // 2^100 - 1
  f25519SquareTimes(t, acc, 100)
  f25519Mul(acc, t, acc) // 2^200 - 1
  f25519SquareTimes(t, acc, 50)
  f25519Mul(acc, t, e50) // 2^250 - 1
  f25519SquareTimes(t, acc, 5)
  f25519Mul(out, t, z11) // 2^255 - 21
}

/**
 * Swaps `f` and `g` when `bit` is 1 and leaves them when it is 0, with the
 * same instructions either way: the mask is all ones or all zeros, and the
 * swap is the masked xor of the two.
 */
const f25519Swap = (f: i64[], g: i64[], bit: i64): void => {
  if (toI32(f.length) < 10 || toI32(g.length) < 10) {
    return
  }
  const mask: i64 = toI64(0) - bit
  for (let i: i32 = 0; i < 10; i++) {
    const t: i64 = mask & (f[i] ^ g[i])
    f[i] = f[i] ^ t
    g[i] = g[i] ^ t
  }
}

/**
 * The field element that 32 little-endian bytes encode, with the top bit of
 * the last byte masked off as RFC 7748 §5 requires of a u-coordinate. The
 * bytes stream into an accumulator and each limb is taken off its low end once
 * it holds enough bits (one byte never completes two limbs), so every limb
 * lands in `[0, 2^width)` and the element is reduced. A value in
 * `[p, 2^255)` is neither refused nor adjusted: §5 has it processed as its
 * residue, and the arithmetic does that by itself.
 */
const f25519Decode = (bytes: u8[]): i64[] => {
  const f: i64[] = new Array<i64>(10)
  if (toI32(bytes.length) < 32) {
    return f
  }
  let acc: i64 = 0
  let bits: i64 = 0
  let limb: i32 = 0
  for (let i: i32 = 0; i < 32; i++) {
    let b: i64 = toI64(bytes[i])
    if (i === 31) {
      b = b & toI64(0x7f)
    }
    acc = acc | (b << bits)
    bits = bits + toI64(8)
    if (limb >= 0 && limb < 10) {
      const width: i64 = f25519Width(limb)
      if (bits >= width) {
        f[limb] = acc & f25519LimbMask(limb)
        acc = acc >> width
        bits = bits - width
        limb = limb + 1
      }
    }
  }
  return f
}

/**
 * The canonical 32-byte encoding of `f`, fully reduced into `[0, p)`.
 *
 * Accepts a reduced element. Two more `f25519Carry` passes bring every limb
 * into `[0, 2^width)`. The first leaves every limb in range except limb 1,
 * which may be one over or one under. The second carries that through, and its
 * fold is ±19 at most on a value that is then within 2^26 of 0 or of 2^255, so
 * its last carry out of limb 0 is at most one and leaves limb 1 in range. The
 * value is then in `[0, 2^255)`, which is `[0, p)` or `[p, p + 19)`. Adding 19 and reading the
 * carry out of bit 255 tells the two apart without a branch — it is 1 exactly
 * when the value is at least p — so the element adds `19 * q` and drops bit
 * 255, which is subtracting `p * q`.
 */
const f25519Encode = (f: i64[]): u8[] => {
  const h: i64[] = new Array<i64>(10)
  f25519Copy(h, f)
  f25519Carry(h)
  f25519Carry(h)

  let q: i64 = (h[0] + toI64(19)) >> toI64(26)
  for (let i: i32 = 1; i < 10; i++) {
    q = (h[i] + q) >> f25519Width(i)
  }
  h[0] = h[0] + q * toI64(19)
  f25519CarryChain(h)
  h[9] = h[9] & f25519LimbMask(9)

  const out: u8[] = new Array<u8>(32)
  let acc: i64 = 0
  let bits: i64 = 0
  let at: i32 = 0
  for (let i: i32 = 0; i < 10; i++) {
    acc = acc | (h[i] << bits)
    bits = bits + f25519Width(i)
    while (bits >= toI64(8) && at >= 0 && at < 32) {
      out[at] = toU8(acc & toI64(0xff))
      acc = acc >> toI64(8)
      bits = bits - toI64(8)
      at = at + 1
    }
  }
  // 255 bits leave seven over: the last byte, with its top bit clear.
  if (at >= 0 && at < 32) {
    out[at] = toU8(acc & toI64(0xff))
  }
  return out
}

/**
 * The Montgomery ladder of RFC 7748 §5 on a clamped scalar `k` and a decoded
 * `u`, answering the encoded u-coordinate of `k * u`.
 *
 * The step formulas are the RFC's, in its order. Every multiplication is given
 * a reduced element or one sum or difference of two, which is what
 * `f25519Mul` accepts: `A`, `B`, `C`, `D`, `E`, `DA + CB`, `DA - CB` and
 * `AA + a24 * E` are each one addition away from reduced values.
 */
const x25519Ladder = (k: u8[], u: i64[]): u8[] => {
  if (toI32(k.length) < 32) {
    return new Array<u8>(32)
  }
  const x2: i64[] = f25519Small(toI64(1))
  const z2: i64[] = f25519Zero()
  const x3: i64[] = f25519Zero()
  const z3: i64[] = f25519Small(toI64(1))
  f25519Copy(x3, u)

  const a: i64[] = f25519Zero()
  const aa: i64[] = f25519Zero()
  const b: i64[] = f25519Zero()
  const bb: i64[] = f25519Zero()
  const e: i64[] = f25519Zero()
  const c: i64[] = f25519Zero()
  const d: i64[] = f25519Zero()
  const da: i64[] = f25519Zero()
  const cb: i64[] = f25519Zero()
  const t: i64[] = f25519Zero()

  let swap: i64 = 0
  // Bit 254 down to bit 0: the position is public and picks the byte and the
  // shift; the bit itself is secret and only ever feeds a mask.
  for (let byte: i32 = 31; byte >= 0; byte--) {
    for (let shift: i32 = 7; shift >= 0; shift--) {
      if (byte === 31 && shift === 7) {
        continue
      }
      const bit: i64 = toI64(k[byte] >> toU8(shift)) & toI64(1)
      swap = swap ^ bit
      f25519Swap(x2, x3, swap)
      f25519Swap(z2, z3, swap)
      swap = bit

      f25519Add(a, x2, z2)
      f25519Square(aa, a)
      f25519Sub(b, x2, z2)
      f25519Square(bb, b)
      f25519Sub(e, aa, bb)
      f25519Add(c, x3, z3)
      f25519Sub(d, x3, z3)
      f25519Mul(da, d, a)
      f25519Mul(cb, c, b)
      f25519Add(t, da, cb)
      f25519Square(x3, t)
      f25519Sub(t, da, cb)
      f25519Square(t, t)
      f25519Mul(z3, u, t)
      f25519Mul(x2, aa, bb)
      f25519MulA24(t, e)
      f25519Add(t, aa, t)
      f25519Mul(z2, e, t)
    }
  }
  f25519Swap(x2, x3, swap)
  f25519Swap(z2, z3, swap)

  f25519Invert(t, z2)
  f25519Mul(x2, x2, t)
  return f25519Encode(x2)
}

/**
 * X25519 (RFC 7748 §5): the u-coordinate of `scalar * u` on curve25519, as 32
 * little-endian bytes.
 *
 * `scalar` is clamped as §5 says — bits 0, 1, 2 and 255 cleared, bit 254 set —
 * on a copy, so the caller's array is not changed. The top bit of `u` is
 * ignored, and a `u` of p or more is taken modulo p. The answer is always
 * canonical (below p).
 *
 * Answers `null` unless both arguments are exactly `X25519_SIZE` bytes. An
 * all-zero answer is **returned, not refused**: it is what a low-order `u`
 * gives, and RFC 7748 §6.1 leaves checking for it to the protocol. Nothing in
 * this tree makes that check for you yet (TLS 1.3, WP34 T1, is planned to), so
 * every caller doing a key exchange must refuse an all-zero answer itself —
 * with `timingSafeEqual` against 32 zero bytes, since the answer is a secret.
 */
export const x25519 = (scalar: u8[], u: u8[]): u8[] | null => {
  if (toI32(scalar.length) !== 32 || toI32(u.length) !== 32) {
    return null
  }
  const k: u8[] = new Array<u8>(32)
  for (let i: i32 = 0; i < 32; i++) {
    k[i] = scalar[i]
  }
  k[0] = k[0] & toU8(248)
  k[31] = (k[31] & toU8(127)) | toU8(64)
  return x25519Ladder(k, f25519Decode(u))
}

/**
 * `x25519(scalar, 9)`: the public key for the private key `scalar`, since 9 is
 * curve25519's base point (RFC 7748 §4.1, §6.1). Answers `null` unless
 * `scalar` is `X25519_SIZE` bytes.
 */
export const x25519Base = (scalar: u8[]): u8[] | null => {
  const base: u8[] = new Array<u8>(32)
  base[0] = toU8(9)
  return x25519(scalar, base)
}
