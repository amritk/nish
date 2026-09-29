// WP34 K3: `nish/crypto/aes`'s constant-time cores under the assembly check in
// tests/run.js: one full round on bitsliced state (Boyar-Peralta's S-box
// circuit, ShiftRows, MixColumns and AddRoundKey on four blocks at once), one
// GHASH multiply in GF(2^128), and the GCM tag compare. The state, the round
// keys, the GHASH accumulator, H and both tags are secret; the round-key
// offset `at` is a round number and public. Indexing is unchecked
// (ct_asm_aes.args), since a bounds check is a branch.
//
// A golden case compiles to one module and so cannot import the library, so
// every function below is a verbatim copy of the one of the same name in
// std/crypto/aes.ts, its comment aside; clang inlines the helpers into the
// three exported functions, which are what the check reads.
// tests/link/crypto_aes holds each exported copy to the module's own function
// on generated inputs, so an edit to one and not the other fails there.
// ct-check: aesBitslicedRound secret=contents
// ct-check: ghashMultiply secret=contents,hHi,hLo
// ct-check: aesGcmTagMask secret=tagHi,tagLo,gotHi,gotLo

// Mirrors `aesLanes` in std/crypto/aes.ts.
const aesLanes = (pattern: u64): u64 => {
  const two: u64 = pattern | (pattern << toU64(16))
  return two | (two << toU64(32))
}

// Mirrors `aesSbox` in std/crypto/aes.ts.
const aesSbox = (q: u64[]): void => {
  const x0: u64 = q[7]
  const x1: u64 = q[6]
  const x2: u64 = q[5]
  const x3: u64 = q[4]
  const x4: u64 = q[3]
  const x5: u64 = q[2]
  const x6: u64 = q[1]
  const x7: u64 = q[0]

  // The top linear layer.
  const y14: u64 = x3 ^ x5
  const y13: u64 = x0 ^ x6
  const y9: u64 = x0 ^ x3
  const y8: u64 = x0 ^ x5
  const t0: u64 = x1 ^ x2
  const y1: u64 = t0 ^ x7
  const y4: u64 = y1 ^ x3
  const y12: u64 = y13 ^ y14
  const y2: u64 = y1 ^ x0
  const y5: u64 = y1 ^ x6
  const y3: u64 = y5 ^ y8
  const t1: u64 = x4 ^ y12
  const y15: u64 = t1 ^ x5
  const y20: u64 = t1 ^ x1
  const y6: u64 = y15 ^ x7
  const y10: u64 = y15 ^ t0
  const y11: u64 = y20 ^ y9
  const y7: u64 = x7 ^ y11
  const y17: u64 = y10 ^ y11
  const y19: u64 = y10 ^ y8
  const y16: u64 = t0 ^ y11
  const y21: u64 = y13 ^ y16
  const y18: u64 = x0 ^ y16

  // The non-linear middle: inversion in GF(2^8) through GF(2^4).
  const t2: u64 = y12 & y15
  const t3: u64 = y3 & y6
  const t4: u64 = t3 ^ t2
  const t5: u64 = y4 & x7
  const t6: u64 = t5 ^ t2
  const t7: u64 = y13 & y16
  const t8: u64 = y5 & y1
  const t9: u64 = t8 ^ t7
  const t10: u64 = y2 & y7
  const t11: u64 = t10 ^ t7
  const t12: u64 = y9 & y11
  const t13: u64 = y14 & y17
  const t14: u64 = t13 ^ t12
  const t15: u64 = y8 & y10
  const t16: u64 = t15 ^ t12
  const t17: u64 = t4 ^ t14
  const t18: u64 = t6 ^ t16
  const t19: u64 = t9 ^ t14
  const t20: u64 = t11 ^ t16
  const t21: u64 = t17 ^ y20
  const t22: u64 = t18 ^ y19
  const t23: u64 = t19 ^ y21
  const t24: u64 = t20 ^ y18

  const t25: u64 = t21 ^ t22
  const t26: u64 = t21 & t23
  const t27: u64 = t24 ^ t26
  const t28: u64 = t25 & t27
  const t29: u64 = t28 ^ t22
  const t30: u64 = t23 ^ t24
  const t31: u64 = t22 ^ t26
  const t32: u64 = t31 & t30
  const t33: u64 = t32 ^ t24
  const t34: u64 = t23 ^ t33
  const t35: u64 = t27 ^ t33
  const t36: u64 = t24 & t35
  const t37: u64 = t36 ^ t34
  const t38: u64 = t27 ^ t36
  const t39: u64 = t29 & t38
  const t40: u64 = t25 ^ t39

  const t41: u64 = t40 ^ t37
  const t42: u64 = t29 ^ t33
  const t43: u64 = t29 ^ t40
  const t44: u64 = t33 ^ t37
  const t45: u64 = t42 ^ t41
  const z0: u64 = t44 & y15
  const z1: u64 = t37 & y6
  const z2: u64 = t33 & x7
  const z3: u64 = t43 & y16
  const z4: u64 = t40 & y1
  const z5: u64 = t29 & y7
  const z6: u64 = t42 & y11
  const z7: u64 = t45 & y17
  const z8: u64 = t41 & y10
  const z9: u64 = t44 & y12
  const z10: u64 = t37 & y3
  const z11: u64 = t33 & y4
  const z12: u64 = t43 & y13
  const z13: u64 = t40 & y5
  const z14: u64 = t29 & y2
  const z15: u64 = t42 & y9
  const z16: u64 = t45 & y14
  const z17: u64 = t41 & y8

  // The bottom linear layer.
  const t46: u64 = z15 ^ z16
  const t47: u64 = z10 ^ z11
  const t48: u64 = z5 ^ z13
  const t49: u64 = z9 ^ z10
  const t50: u64 = z2 ^ z12
  const t51: u64 = z2 ^ z5
  const t52: u64 = z7 ^ z8
  const t53: u64 = z0 ^ z3
  const t54: u64 = z6 ^ z7
  const t55: u64 = z16 ^ z17
  const t56: u64 = z12 ^ t48
  const t57: u64 = t50 ^ t53
  const t58: u64 = z4 ^ t46
  const t59: u64 = z3 ^ t54
  const t60: u64 = t46 ^ t57
  const t61: u64 = z14 ^ t57
  const t62: u64 = t52 ^ t58
  const t63: u64 = t49 ^ t58
  const t64: u64 = z4 ^ t59
  const t65: u64 = t61 ^ t62
  const t66: u64 = z1 ^ t63
  const s0: u64 = t59 ^ t63
  const s6: u64 = t56 ^ ~t62
  const s7: u64 = t48 ^ ~t60
  const t67: u64 = t64 ^ t65
  const s3: u64 = t53 ^ t66
  const s4: u64 = t51 ^ t66
  const s5: u64 = t47 ^ t65
  const s1: u64 = t64 ^ ~s3
  const s2: u64 = t55 ^ ~t67

  q[7] = s0
  q[6] = s1
  q[5] = s2
  q[4] = s3
  q[3] = s4
  q[2] = s5
  q[1] = s6
  q[0] = s7
}

// Mirrors `aesShiftPlane` in std/crypto/aes.ts.
const aesShiftPlane = (x: u64): u64 =>
  (x & aesLanes(toU64(0x000f))) |
  ((x >> toU64(1)) & aesLanes(toU64(0x0070))) |
  ((x << toU64(3)) & aesLanes(toU64(0x0080))) |
  ((x >> toU64(2)) & aesLanes(toU64(0x0300))) |
  ((x << toU64(2)) & aesLanes(toU64(0x0c00))) |
  ((x >> toU64(3)) & aesLanes(toU64(0x1000))) |
  ((x << toU64(1)) & aesLanes(toU64(0xe000)))

// Mirrors `aesShiftRows` in std/crypto/aes.ts.
const aesShiftRows = (q: u64[]): void => {
  q[0] = aesShiftPlane(q[0])
  q[1] = aesShiftPlane(q[1])
  q[2] = aesShiftPlane(q[2])
  q[3] = aesShiftPlane(q[3])
  q[4] = aesShiftPlane(q[4])
  q[5] = aesShiftPlane(q[5])
  q[6] = aesShiftPlane(q[6])
  q[7] = aesShiftPlane(q[7])
}

// Mirrors `aesNextRow` in std/crypto/aes.ts.
const aesNextRow = (x: u64): u64 =>
  ((x >> toU64(4)) & aesLanes(toU64(0x0fff))) | ((x << toU64(12)) & aesLanes(toU64(0xf000)))

// Mirrors `aesRowAfterNext` in std/crypto/aes.ts.
const aesRowAfterNext = (x: u64): u64 =>
  ((x >> toU64(8)) & aesLanes(toU64(0x00ff))) | ((x << toU64(8)) & aesLanes(toU64(0xff00)))

// Mirrors `aesMixColumns` in std/crypto/aes.ts.
const aesMixColumns = (q: u64[]): void => {
  const n0: u64 = aesNextRow(q[0])
  const n1: u64 = aesNextRow(q[1])
  const n2: u64 = aesNextRow(q[2])
  const n3: u64 = aesNextRow(q[3])
  const n4: u64 = aesNextRow(q[4])
  const n5: u64 = aesNextRow(q[5])
  const n6: u64 = aesNextRow(q[6])
  const n7: u64 = aesNextRow(q[7])
  const t0: u64 = q[0] ^ n0
  const t1: u64 = q[1] ^ n1
  const t2: u64 = q[2] ^ n2
  const t3: u64 = q[3] ^ n3
  const t4: u64 = q[4] ^ n4
  const t5: u64 = q[5] ^ n5
  const t6: u64 = q[6] ^ n6
  const t7: u64 = q[7] ^ n7
  q[0] = t7 ^ n0 ^ aesRowAfterNext(t0)
  q[1] = t0 ^ t7 ^ n1 ^ aesRowAfterNext(t1)
  q[2] = t1 ^ n2 ^ aesRowAfterNext(t2)
  q[3] = t2 ^ t7 ^ n3 ^ aesRowAfterNext(t3)
  q[4] = t3 ^ t7 ^ n4 ^ aesRowAfterNext(t4)
  q[5] = t4 ^ n5 ^ aesRowAfterNext(t5)
  q[6] = t5 ^ n6 ^ aesRowAfterNext(t6)
  q[7] = t6 ^ n7 ^ aesRowAfterNext(t7)
}

// Mirrors `aesAddRoundKey` in std/crypto/aes.ts.
const aesAddRoundKey = (q: u64[], rk: u64[], at: i32): void => {
  q[0] = q[0] ^ rk[at]
  q[1] = q[1] ^ rk[at + 1]
  q[2] = q[2] ^ rk[at + 2]
  q[3] = q[3] ^ rk[at + 3]
  q[4] = q[4] ^ rk[at + 4]
  q[5] = q[5] ^ rk[at + 5]
  q[6] = q[6] ^ rk[at + 6]
  q[7] = q[7] ^ rk[at + 7]
}

// Mirrors `aesBitslicedRound` in std/crypto/aes.ts.
export const aesBitslicedRound = (q: u64[], rk: u64[], at: i32): void => {
  aesSbox(q)
  aesShiftRows(q)
  aesMixColumns(q)
  aesAddRoundKey(q, rk, at)
}

// Mirrors `ghashMul32` in std/crypto/aes.ts, and carries the same notice:
// Adapted from BearSSL (https://www.bearssl.org/), src/hash/ghash_ctmul64.c
// bmul64(). Copyright (c) 2016 Thomas Pornin. Used under the MIT licence;
// see std/crypto/LICENSE-bearssl.
const ghashMul32 = (x: u64, y: u64): u64 => {
  const m0: u64 = toU64(0x11111111)
  const m1: u64 = toU64(0x22222222)
  const m2: u64 = toU64(0x44444444)
  const m3: u64 = m2 << toU64(1)
  const x0: u64 = x & m0
  const x1: u64 = x & m1
  const x2: u64 = x & m2
  const x3: u64 = x & m3
  const y0: u64 = y & m0
  const y1: u64 = y & m1
  const y2: u64 = y & m2
  const y3: u64 = y & m3
  const z0: u64 = (x0 * y0) ^ (x1 * y3) ^ (x2 * y2) ^ (x3 * y1)
  const z1: u64 = (x0 * y1) ^ (x1 * y0) ^ (x2 * y3) ^ (x3 * y2)
  const z2: u64 = (x0 * y2) ^ (x1 * y1) ^ (x2 * y0) ^ (x3 * y3)
  const z3: u64 = (x0 * y3) ^ (x1 * y2) ^ (x2 * y1) ^ (x3 * y0)
  const w0: u64 = m0 | (m0 << toU64(32))
  return (z0 & w0) | (z1 & (w0 << toU64(1))) | (z2 & (w0 << toU64(2))) | (z3 & (w0 << toU64(3)))
}

// Mirrors `ghashMultiply` in std/crypto/aes.ts.
export const ghashMultiply = (y: u64[], hHi: u64, hLo: u64): void => {
  const low32: u64 = (toU64(1) << toU64(32)) - toU64(1)
  const thirtyTwo: u64 = toU64(32)
  const a1: u64 = y[0]
  const a0: u64 = y[1]
  const a2: u64 = a1 ^ a0
  const b2: u64 = hHi ^ hLo

  // A0 · B0, as `lHi:lLo`.
  const l0: u64 = ghashMul32(a0 & low32, hLo & low32)
  const l1: u64 = ghashMul32(a0 >> thirtyTwo, hLo >> thirtyTwo)
  const l2: u64 = ghashMul32((a0 ^ (a0 >> thirtyTwo)) & low32, (hLo ^ (hLo >> thirtyTwo)) & low32) ^ l0 ^ l1
  const lHi: u64 = l1 ^ (l2 >> thirtyTwo)
  const lLo: u64 = l0 ^ (l2 << thirtyTwo)

  // A1 · B1, as `hHi2:hLo2`.
  const h0: u64 = ghashMul32(a1 & low32, hHi & low32)
  const h1: u64 = ghashMul32(a1 >> thirtyTwo, hHi >> thirtyTwo)
  const h2: u64 = ghashMul32((a1 ^ (a1 >> thirtyTwo)) & low32, (hHi ^ (hHi >> thirtyTwo)) & low32) ^ h0 ^ h1
  const hiHi: u64 = h1 ^ (h2 >> thirtyTwo)
  const hiLo: u64 = h0 ^ (h2 << thirtyTwo)

  // (A0 ⊕ A1) · (B0 ⊕ B1), less the other two, as `mHi:mLo`.
  const m0: u64 = ghashMul32(a2 & low32, b2 & low32)
  const m1: u64 = ghashMul32(a2 >> thirtyTwo, b2 >> thirtyTwo)
  const m2: u64 = ghashMul32((a2 ^ (a2 >> thirtyTwo)) & low32, (b2 ^ (b2 >> thirtyTwo)) & low32) ^ m0 ^ m1
  const mHi: u64 = m1 ^ (m2 >> thirtyTwo) ^ lHi ^ hiHi
  const mLo: u64 = m0 ^ (m2 << thirtyTwo) ^ lLo ^ hiLo

  // The 256-bit product p3:p2:p1:p0, shifted left once.
  const r3: u64 = hiHi
  const r2: u64 = hiLo ^ mHi
  const r1: u64 = lHi ^ mLo
  const r0: u64 = lLo
  const one: u64 = toU64(1)
  const top: u64 = toU64(63)
  const p3: u64 = (r3 << one) | (r2 >> top)
  const p2: u64 = (r2 << one) | (r1 >> top)
  const p1: u64 = (r1 << one) | (r0 >> top)
  const p0: u64 = r0 << one

  // Reduce: fold the lowest bits of p1:p0 into p1 first, then all of it up.
  const d1: u64 = p1 ^ (p0 << toU64(63)) ^ (p0 << toU64(62)) ^ (p0 << toU64(57))
  y[0] = p3 ^ d1 ^ (d1 >> one) ^ (d1 >> toU64(2)) ^ (d1 >> toU64(7))
  y[1] =
    p2 ^
    p0 ^
    (p0 >> one) ^
    (d1 << top) ^
    (p0 >> toU64(2)) ^
    (d1 << toU64(62)) ^
    (p0 >> toU64(7)) ^
    (d1 << toU64(57))
}

// Mirrors `aesGcmTagMask` in std/crypto/aes.ts.
export const aesGcmTagMask = (tagHi: u64, tagLo: u64, gotHi: u64, gotLo: u64): u64 =>
  ctEq((tagHi ^ gotHi) | (tagLo ^ gotLo), toU64(0))
