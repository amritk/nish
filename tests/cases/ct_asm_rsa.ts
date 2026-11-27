// TLS RSA S1: `nish/crypto/rsa-sign`'s constant-time core under the assembly
// check in tests/run.js: the masked final subtraction, one CIOS Montgomery
// multiplication, and one step of the fixed 4-bit window, which squares four
// times, reads all 16 table entries and keeps the one at the secret nibble by
// a `ctEq` mask. The limbs (the base, the accumulator, the table, the private
// exponent's nibble) are secret; `count`, the modulus and `n0inv` are public.
// The guards at the top of each function and the bounds checks of each `a[i]`
// branch on lengths and public loop counters only, which `loops` allows.
//
// A golden case compiles to one module and so cannot import the library, so
// every function below is a copy of the one of the same name in
// std/crypto/rsa-sign.ts, comments aside; tests/run.js compares each copy
// with the module's text, so an edit to one and not the other fails there.
// `rsaSignMontMul` and `rsaSignWindowStep` take seven and eight parameters,
// past the six x86-64 passes in registers, so the check reads them through
// `rsaSignMontMulAt` and `rsaSignWindowStepAt`, which call them with a fixed
// odd `n0inv` (public, and only ever multiplied) and, for the window step, 64
// limbs, a 2048-bit modulus; the check follows each call into the copy.
// `rsaSignTableLoad` is the window step the module does not write: it indexes
// the table by the nibble, and the check must refuse its secret-addressed load.
// `rsaSignModAdd`, `rsaSignModSub`, `rsaSignLess` and `rsaSignMul` are the CRT
// form's own arithmetic: the half's Montgomery form of `m`, Garner's
// difference, the load's and the check's comparisons, and `q h`.
// ct-check: rsaSignReduce secret=contents,top loops
// ct-check: rsaSignMontMulAt secret=contents loops
// ct-check: rsaSignWindowStepAt secret=contents,nibble loops
// ct-check: rsaSignTableLoad secret=contents,nibble loops expect=load
// ct-check: rsaSignModAdd secret=contents loops
// ct-check: rsaSignModSub secret=contents loops
// ct-check: rsaSignLess secret=contents loops
// ct-check: rsaSignMul secret=contents loops

export const rsaSignReduce = (out: u32[], t: u32[], top: u32, n: u32[], count: i32): void => {
  if (count < 1 || count > 128 || toI32(out.length) < 128 || toI32(t.length) < 128 || toI32(n.length) < 128) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(t[i]) - toU64(n[i]) - borrow
    out[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  // `t` stays when there is no top limb and the subtraction borrowed.
  const keep: u32 = toU32(borrow) & (top ^ 1)
  const take: u32 = ctEq(keep, 0)
  for (let i: i32 = 0; i < count; i++) {
    out[i] = ctSelect(take, out[i], t[i])
  }
}

const rsaSignMontMul = (out: u32[], a: u32[], b: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  if (
    toI32(out.length) < 128 ||
    toI32(b.length) < 128 ||
    count > 128 ||
    count < 1 ||
    toI32(t.length) < 130 ||
    toI32(a.length) < 128 ||
    toI32(n.length) < 128
  ) {
    return
  }
  for (let i: i32 = 0; i < count; i++) {
    // The first row reads `t` as zero, so no loop clears it first (one that
    // the compiler would make a `memset` call).
    const live: u64 = i === 0 ? 0 : 0xffffffff
    const bi: u64 = toU64(b[i])
    let carry: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const s: u64 = (toU64(t[j]) & live) + toU64(a[j]) * bi + carry
      t[j] = toU32(s)
      carry = s >> 32
    }
    const top: u64 = (toU64(t[count]) & live) + carry
    t[count] = toU32(top)
    t[count + 1] = toU32(top >> 32)
    const m: u64 = toU64(toU32(toU64(t[0]) * toU64(n0inv)))
    let c: u64 = (toU64(t[0]) + m * toU64(n[0])) >> 32
    for (let j: i32 = 1; j < count; j++) {
      const s: u64 = toU64(t[j]) + m * toU64(n[j]) + c
      t[j - 1] = toU32(s)
      c = s >> 32
    }
    const last: u64 = toU64(t[count]) + c
    t[count - 1] = toU32(last)
    t[count] = t[count + 1] + toU32(last >> 32)
  }
  rsaSignReduce(out, t, t[count], n, count)
}

const rsaSignWindowStep = (
  acc: u32[],
  table: u32[],
  sel: u32[],
  nibble: u32,
  n: u32[],
  n0inv: u32,
  t: u32[],
  count: i32
): void => {
  if (count < 1 || count > 128 || toI32(table.length) < 16 * count || toI32(sel.length) < 128) {
    return
  }
  for (let s: i32 = 0; s < 4; s++) {
    rsaSignMontMul(acc, acc, acc, n, n0inv, t, count)
  }
  for (let l: i32 = 0; l < count; l++) {
    sel[l] = 0
  }
  for (let j: i32 = 0; j < 16; j++) {
    const mask: u32 = ctEq(toU32(j), nibble)
    for (let l: i32 = 0; l < count; l++) {
      sel[l] = sel[l] | (table[j * count + l] & mask)
    }
  }
  rsaSignMontMul(acc, acc, sel, n, n0inv, t, count)
}

/** An odd -n^-1 mod 2^32 stand-in: public, and only multiplied by. */
const N0INV: number = 0x6f3cd2a7

/** `rsaSignMontMul` under the stand-in `n0inv`, in six parameters. */
export const rsaSignMontMulAt = (out: u32[], a: u32[], b: u32[], n: u32[], t: u32[], count: i32): void => {
  rsaSignMontMul(out, a, b, n, toU32(N0INV), t, count)
}

/** `rsaSignWindowStep` under the stand-in `n0inv` on 64 limbs, in six parameters. */
export const rsaSignWindowStepAt = (acc: u32[], table: u32[], sel: u32[], nibble: u32, n: u32[], t: u32[]): void => {
  rsaSignWindowStep(acc, table, sel, nibble, n, toU32(N0INV), t, 64)
}

export const rsaSignTableLoad = (acc: u32[], table: u32[], sel: u32[], nibble: u32, count: i32): void => {
  if (count < 1 || count > 128 || toI32(table.length) < 16 * count || toI32(sel.length) < 128) {
    return
  }
  for (let l: i32 = 0; l < count; l++) {
    sel[l] = table[toI32(nibble) * count + l]
  }
}

export const rsaSignModAdd = (out: u32[], a: u32[], b: u32[], n: u32[], t: u32[], count: i32): void => {
  if (count < 1 || count > 128 || toI32(a.length) < 128 || toI32(b.length) < 128 || toI32(t.length) < 128) {
    return
  }
  let carry: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const s: u64 = toU64(a[i]) + toU64(b[i]) + carry
    t[i] = toU32(s)
    carry = s >> 32
  }
  rsaSignReduce(out, t, toU32(carry), n, count)
}

export const rsaSignModSub = (out: u32[], a: u32[], b: u32[], n: u32[], t: u32[], count: i32): void => {
  if (
    count < 1 ||
    count > 128 ||
    toI32(out.length) < 128 ||
    toI32(a.length) < 128 ||
    toI32(b.length) < 128 ||
    toI32(n.length) < 128 ||
    toI32(t.length) < 128
  ) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    t[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  const back: u32 = ctEq(toU32(borrow), 1)
  let carry: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const s: u64 = toU64(t[i]) + toU64(n[i] & back) + carry
    out[i] = toU32(s)
    carry = s >> 32
  }
}

export const rsaSignLess = (a: u32[], b: u32[], count: i32): u32 => {
  if (count < 1 || count > 128 || toI32(a.length) < 128 || toI32(b.length) < 128) {
    return 0
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    borrow = (d >> 32) & 1
  }
  return toU32(borrow)
}

export const rsaSignMul = (out: u32[], a: u32[], b: u32[], count: i32): void => {
  if (count < 1 || count > 64 || toI32(out.length) < 128 || toI32(a.length) < 128 || toI32(b.length) < 128) {
    return
  }
  for (let i: i32 = 0; i < count; i++) {
    out[i] = 0
    out[i + count] = 0
  }
  for (let i: i32 = 0; i < count; i++) {
    const ai: u64 = toU64(a[i])
    let carry: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const s: u64 = toU64(out[i + j]) + ai * toU64(b[j]) + carry
      out[i + j] = toU32(s)
      carry = s >> 32
    }
    out[i + count] = toU32(carry)
  }
}
