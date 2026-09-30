/**
 * `nish/crypto/aes` — AES-128 and AES-256 (FIPS 197), GCM on top of them
 * (NIST SP 800-38D), and QUIC's AES header-protection mask (RFC 9001 §5.4.3).
 *
 * Written from the specifications and the papers below, in this module's own
 * layout, with one exception: `ghashMul32` is adapted from BearSSL's
 * `bmul64`, and carries BearSSL's notice. Nothing else here is ported from
 * another implementation.
 *
 * - **Bitslicing** is the idea of E. Käsper and P. Schwabe, "Faster and
 *   Timing-Attack Resistant AES-GCM" (CHES 2009): hold bit `b` of many bytes
 *   in one word, so that SubBytes is a Boolean circuit run on whole words and
 *   no byte ever becomes a table index.
 * - **The S-box circuit** is J. Boyar and R. Peralta's, "A depth-16 circuit
 *   for the AES S-box" (SEC 2012) and the 113-gate listing published with it:
 *   a linear layer in, 32 ANDs over GF(2^4) and GF(2^2) arithmetic, a linear
 *   layer out. `aesSbox` keeps their variable names so it can be read against
 *   the paper, gate by gate.
 * - **GHASH's multiply** is carry-less multiplication done with the integer
 *   multiplier, by leaving three zero bits of "holes" between the bits of each
 *   operand so that the carries of an integer product land where nothing is
 *   read — T. Pornin's technique, and `ghashMul32` is his `bmul64` from
 *   BearSSL narrowed to 32-bit operands — with Karatsuba's three-for-four
 *   split on top (this module's own), and the
 *   reduction of S. Gueron and M. Kounavis, "Intel Carry-Less Multiplication
 *   Instruction and its Usage for Computing the GCM Mode" (2010), for GCM's
 *   bit-reflected field.
 *
 * **The bitsliced state.** Four blocks at a time sit in eight `u64` words,
 * `q[0..7]`, word `b` holding bit `b` of all 64 bytes. Inside a word, block `k`
 * owns the 16 bits from `16k`, and in those the byte in row `r` and column `c`
 * of the AES state is bit `4r + c`: each row is one nibble. That makes the two
 * permutations cheap. ShiftRows turns row `r` by `r` columns, which is a
 * rotation of nibble `r` by `r` bits; MixColumns needs each byte's neighbour
 * in the next row of its column, which is the word rotated by four bits inside
 * each 16-bit lane. Getting 64 bytes in and out of that layout is an 8 × 8
 * bit-matrix transpose per byte lane (`aesTranspose`, three rounds of masked
 * swaps between words) after placing each byte in the word and slot the
 * transpose will carry to its bit (`aesPack`, `aesUnpack`).
 *
 * **Constant time.** No table is read anywhere, key schedule included: the
 * S-box is the circuit, and `SubWord` in the key schedule runs the same
 * circuit on a four-byte state. No branch or index depends on a key, a
 * plaintext, a tag or H: every `if` and every loop bound is on a length, a
 * block number or the round count. GHASH multiplies with no table and no
 * data-dependent shift, and `aesGcmOpen` computes the whole tag and compares
 * it with `aesGcmTagMask` — a difference ORed into one word and handed to
 * `ctEq` — before it decrypts or returns anything. What `tests/ct-asm.js`
 * verifies by disassembly on x86-64 and aarch64 is one full round
 * (`aesBitslicedRound`: S-box circuit, ShiftRows, MixColumns, AddRoundKey),
 * one GHASH multiply (`ghashMultiply`) and the tag compare
 * (`aesGcmTagMask`). A golden case compiles to one module and cannot import
 * this one, so `tests/cases/ct_asm_aes` holds a verbatim copy of those three
 * and the helpers they call, and `tests/link/crypto_aes` checks that the copy
 * and this module agree on generated inputs, so neither can drift from the
 * other unnoticed. Everything around them — packing bytes, the key schedule,
 * the loops over blocks — is the discipline above and not a verified
 * property.
 *
 * **What is refused.** A key of any length but 16 or 32 bytes (AES-192 is out
 * of scope), a block or a sample that is not 16 bytes, an empty IV (SP 800-38D
 * §5.2.1.1 asks for at least one bit), a sealed input shorter than its tag and
 * a plaintext too long for its sealed form to be an array answer `null`; so
 * does a tag that does not verify. An IV of any other non-zero
 * length is hashed into the first counter block as §7.1 says.
 *
 * Private names carry the `aes` / `ghash` prefix because a `std/` module's
 * private functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */

/** The AES block, in bytes. */
export const AES_BLOCK: i32 = 16
/** GCM's tag, in bytes: this module makes and accepts only the full 128 bits. */
export const AES_GCM_TAG_SIZE: i32 = 16

/** The 64 bytes one pass of the bitsliced cipher encrypts: four blocks. */
const AES_BATCH: i32 = 64

/**
 * An AES key, expanded: the round keys already bitsliced, and GCM's hash key
 * H = E(K, 0^128), so a key used for many messages is expanded once.
 */
export class AesKey {
  /** Nr: 10 for AES-128, 14 for AES-256. */
  rounds: i32 = 0
  /**
   * Round key `i` in the bitsliced layout, replicated into all four block
   * lanes, as eight words from `8 * i`: `8 * (rounds + 1)` words in all.
   */
  roundKeys: u64[]
  /** H as a big-endian 128-bit number, high half. */
  hHi: u64 = 0
  /** H, low half. */
  hLo: u64 = 0

  constructor(rounds: i32, roundKeys: u64[]) {
    this.rounds = rounds
    this.roundKeys = roundKeys
  }
}

/** A 16-bit pattern repeated into each of a word's four 16-bit lanes. */
const aesLanes = (pattern: u64): u64 => {
  const two: u64 = pattern | (pattern << toU64(16))
  return two | (two << toU64(32))
}

/** An 8-bit pattern repeated into each of a word's eight bytes. */
const aesBytes = (pattern: u64): u64 => aesLanes(pattern | (pattern << toU64(8)))

/**
 * Swaps, in every byte lane, the bits of `q[i]` selected by `mask << shift`
 * with the bits of `q[j]` selected by `mask`: one round of the transpose.
 */
const aesSwapBits = (q: u64[], i: i32, j: i32, mask: u64, shift: u64): void => {
  const t: u64 = ((q[i] >> shift) ^ q[j]) & mask
  q[j] = q[j] ^ t
  q[i] = q[i] ^ (t << shift)
}

/**
 * Transposes, in each of the eight byte lanes, the 8 × 8 bit matrix whose
 * row `i` is that byte of `q[i]`: afterwards bit `i` of the byte in `q[b]` is
 * what bit `b` of the byte in `q[i]` was. Its own inverse, so it both enters
 * and leaves the bitsliced layout. Swaps 1 × 1, then 2 × 2, then 4 × 4
 * blocks across the diagonal.
 */
const aesTranspose = (q: u64[]): void => {
  const m1: u64 = aesBytes(toU64(0x55))
  const m2: u64 = aesBytes(toU64(0x33))
  const m4: u64 = aesBytes(toU64(0x0f))
  aesSwapBits(q, 0, 1, m1, toU64(1))
  aesSwapBits(q, 2, 3, m1, toU64(1))
  aesSwapBits(q, 4, 5, m1, toU64(1))
  aesSwapBits(q, 6, 7, m1, toU64(1))
  aesSwapBits(q, 0, 2, m2, toU64(2))
  aesSwapBits(q, 1, 3, m2, toU64(2))
  aesSwapBits(q, 4, 6, m2, toU64(2))
  aesSwapBits(q, 5, 7, m2, toU64(2))
  aesSwapBits(q, 0, 4, m4, toU64(4))
  aesSwapBits(q, 1, 5, m4, toU64(4))
  aesSwapBits(q, 2, 6, m4, toU64(4))
  aesSwapBits(q, 3, 7, m4, toU64(4))
}

/**
 * Loads the four blocks of `buf[0 .. 64)` into the bitsliced state. After the
 * transpose, bit `8p + i` of every word comes from byte slot `p` of `q[i]`,
 * and that bit must be `16k + 4r + c` for block `k`'s byte in row `r` and
 * column `c` (`buf[16k + 4c + r]`): so `i = 4 * (r & 1) + c` and
 * `p = 2k + (r >> 1)`, which is the four lines in the loop.
 */
const aesPack = (q: u64[], buf: u8[]): void => {
  if (toI32(q.length) < 8 || toI32(buf.length) < 64) {
    return
  }
  for (let i: i32 = 0; i < 8; i++) {
    q[i] = 0
  }
  for (let k: i32 = 0; k < 4; k++) {
    const low: u64 = toU64(16 * k)
    const high: u64 = toU64(16 * k + 8)
    for (let c: i32 = 0; c < 4; c++) {
      q[c] = q[c] | (toU64(buf[16 * k + 4 * c]) << low) | (toU64(buf[16 * k + 4 * c + 2]) << high)
      q[c + 4] = q[c + 4] | (toU64(buf[16 * k + 4 * c + 1]) << low) | (toU64(buf[16 * k + 4 * c + 3]) << high)
    }
  }
  aesTranspose(q)
}

/** The inverse of `aesPack`: the four blocks of the state into `buf[0 .. 64)`. Spends `q`. */
const aesUnpack = (buf: u8[], q: u64[]): void => {
  if (toI32(q.length) < 8 || toI32(buf.length) < 64) {
    return
  }
  aesTranspose(q)
  // `toU8` keeps the low eight bits, so each byte needs no mask.
  for (let k: i32 = 0; k < 4; k++) {
    const low: u64 = toU64(16 * k)
    const high: u64 = toU64(16 * k + 8)
    for (let c: i32 = 0; c < 4; c++) {
      buf[16 * k + 4 * c] = toU8(q[c] >> low)
      buf[16 * k + 4 * c + 2] = toU8(q[c] >> high)
      buf[16 * k + 4 * c + 1] = toU8(q[c + 4] >> low)
      buf[16 * k + 4 * c + 3] = toU8(q[c + 4] >> high)
    }
  }
}

/**
 * SubBytes on every byte of the state at once: Boyar and Peralta's circuit,
 * with their names. `x0` is the most significant bit of a byte, so it is
 * `q[7]`, and the answer `s0` goes back to `q[7]` too. The three `^ ~` terms
 * are the circuit's XNOR gates, the affine constant 0x63.
 */
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

/**
 * ShiftRows on one bit plane: row `r` is nibble `r` of each 16-bit lane, and
 * its column `c` takes column `c + r` (mod 4), so the nibble turns right by `r`.
 */
const aesShiftPlane = (x: u64): u64 =>
  (x & aesLanes(toU64(0x000f))) |
  ((x >> toU64(1)) & aesLanes(toU64(0x0070))) |
  ((x << toU64(3)) & aesLanes(toU64(0x0080))) |
  ((x >> toU64(2)) & aesLanes(toU64(0x0300))) |
  ((x << toU64(2)) & aesLanes(toU64(0x0c00))) |
  ((x >> toU64(3)) & aesLanes(toU64(0x1000))) |
  ((x << toU64(1)) & aesLanes(toU64(0xe000)))

/** ShiftRows (FIPS 197 §5.1.2) on the whole state. */
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

/** Each byte replaced by the byte one row down its column (row 3 by row 0): nibbles turned by one. */
const aesNextRow = (x: u64): u64 =>
  ((x >> toU64(4)) & aesLanes(toU64(0x0fff))) | ((x << toU64(12)) & aesLanes(toU64(0xf000)))

/** Each byte replaced by the byte two rows down its column. */
const aesRowAfterNext = (x: u64): u64 =>
  ((x >> toU64(8)) & aesLanes(toU64(0x00ff))) | ((x << toU64(8)) & aesLanes(toU64(0xff00)))

/**
 * MixColumns (FIPS 197 §5.1.3): s'_r = 2·s_r ⊕ 3·s_{r+1} ⊕ s_{r+2} ⊕ s_{r+3},
 * rewritten as 2·t ⊕ s_{r+1} ⊕ (t two rows down) with t = s_r ⊕ s_{r+1}, so
 * the one multiplication by 2 is a shift of the planes: plane `b` of 2·t is
 * plane `b - 1` of t, and t's top plane folds back into planes 0, 1, 3 and 4
 * for the reduction by x^8 + x^4 + x^3 + x + 1.
 */
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

/** AddRoundKey (FIPS 197 §5.1.4): the eight words of `rk` from `at` into the state. */
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

/**
 * One full middle round of the cipher on bitsliced state — SubBytes,
 * ShiftRows, MixColumns, then the round key of eight words from `at` — for
 * four blocks at once. Straight-line code with no branch and no index but
 * `at`, which is a round number times eight. Exported so that
 * `tests/link/crypto_aes` can hold the copy the disassembly check reads to
 * this one; a caller has no other use for it.
 */
export const aesBitslicedRound = (q: u64[], rk: u64[], at: i32): void => {
  aesSbox(q)
  aesShiftRows(q)
  aesMixColumns(q)
  aesAddRoundKey(q, rk, at)
}

/** The cipher (FIPS 197 §5.1) on the four blocks of `buf[0 .. 64)`, in place. `q` is scratch. */
const aesEncryptBatch = (key: AesKey, buf: u8[], q: u64[]): void => {
  const rk: u64[] = key.roundKeys
  aesPack(q, buf)
  aesAddRoundKey(q, rk, 0)
  for (let round: i32 = 1; round < key.rounds; round++) {
    aesBitslicedRound(q, rk, 8 * round)
  }
  aesSbox(q)
  aesShiftRows(q)
  aesAddRoundKey(q, rk, 8 * key.rounds)
  aesUnpack(buf, q)
}

/**
 * SubWord (FIPS 197 §5.2) through the same circuit: the four bytes of `w`
 * become bits 0 to 3 of eight planes, the circuit runs, and the bits come
 * back. The unused bits of the planes are zero going in and are ignored
 * coming out. No table, so the key schedule is as constant-time as a round.
 */
const aesSubWord = (w: u32, q: u64[]): u32 => {
  if (toI32(q.length) < 8) {
    return 0
  }
  for (let b: i32 = 0; b < 8; b++) {
    let plane: u64 = 0
    for (let m: i32 = 0; m < 4; m++) {
      plane = plane | (toU64((w >> toU32(8 * m + b)) & toU32(1)) << toU64(m))
    }
    q[b] = plane
  }
  aesSbox(q)
  let out: u32 = 0
  for (let b: i32 = 0; b < 8; b++) {
    for (let m: i32 = 0; m < 4; m++) {
      out = out | (toU32((q[b] >> toU64(m)) & toU64(1)) << toU32(8 * m + b))
    }
  }
  return out
}

/** Four bytes of `data` from `at` as a big-endian word; the caller has checked the window. */
const aesLoad32 = (data: u8[], at: i32): u32 =>
  (toU32(data[at]) << toU32(24)) |
  (toU32(data[at + 1]) << toU32(16)) |
  (toU32(data[at + 2]) << toU32(8)) |
  toU32(data[at + 3])

/** `w` big-endian into `out[at .. at + 4)`; the caller has checked the window. */
const aesStore32 = (out: u8[], at: i32, w: u32): void => {
  out[at] = toU8(w >> toU32(24))
  out[at + 1] = toU8(w >> toU32(16))
  out[at + 2] = toU8(w >> toU32(8))
  out[at + 3] = toU8(w)
}

/**
 * KeyExpansion (FIPS 197 §5.2) for Nk = 4 or 8, then every round key
 * bitsliced and replicated into the four block lanes. `w` holds the words
 * big-endian, byte 0 of the key in the high byte of `w[0]`, as the standard
 * writes them. Branches only on the word number.
 */
const aesExpand = (key: u8[], rounds: i32): u64[] => {
  const nk: i32 = rounds - 6
  const total: i32 = (rounds + 1) * 4
  const w: u32[] = new Array<u32>(total)
  const q: u64[] = new Array<u64>(8)
  const keyLength: i32 = toI32(key.length)
  const wLength: i32 = toI32(w.length)
  // Rcon[i/Nk] = x^(i/Nk - 1) in GF(2^8), doubled once per Nk words.
  let rcon: u32 = 1
  for (let i: i32 = 0; i < wLength; i++) {
    if (i < nk) {
      const at: i32 = 4 * i
      if (at >= 0 && at + 3 < keyLength) {
        w[i] = aesLoad32(key, at)
      }
    } else {
      let temp: u32 = w[i - 1]
      if (i % nk === 0) {
        temp = aesSubWord((temp << toU32(8)) | (temp >> toU32(24)), q) ^ (rcon << toU32(24))
        rcon = ((rcon << toU32(1)) ^ (toU32(0x1b) & (toU32(0) - (rcon >> toU32(7))))) & toU32(0xff)
      } else if (nk > 6 && i % nk === 4) {
        temp = aesSubWord(temp, q)
      }
      w[i] = w[i - nk] ^ temp
    }
  }
  // Each round key, written into all four blocks of a batch and packed.
  const rk: u64[] = new Array<u64>((rounds + 1) * 8)
  const buf: u8[] = new Array<u8>(AES_BATCH)
  for (let round: i32 = 0; round <= rounds; round++) {
    for (let k: i32 = 0; k < 4; k++) {
      for (let j: i32 = 0; j < 4; j++) {
        aesStore32(buf, 16 * k + 4 * j, w[4 * round + j])
      }
    }
    aesPack(q, buf)
    for (let b: i32 = 0; b < 8; b++) {
      rk[8 * round + b] = q[b]
    }
  }
  return rk
}

/**
 * Eight bytes of `data` from `at`, big-endian, reading only below `end` and
 * zero past it: how GHASH pads a partial last block (SP 800-38D §6.4).
 */
const aesLoad64 = (data: u8[], at: i32, end: i32): u64 => {
  const length: i32 = toI32(data.length)
  let v: u64 = 0
  for (let i: i32 = 0; i < 8; i++) {
    const from: i32 = at + i
    let byte: u64 = 0
    if (from >= 0 && from < end && from < length) {
      byte = toU64(data[from])
    }
    v = v | (byte << toU64((7 - i) * 8))
  }
  return v
}

/** `v` big-endian into `out[at .. at + 8)`; a byte outside `out` is dropped. */
const aesStore64 = (out: u8[], at: i32, v: u64): void => {
  const length: i32 = toI32(out.length)
  for (let i: i32 = 0; i < 8; i++) {
    const to: i32 = at + i
    if (to >= 0 && to < length) {
      out[to] = toU8(v >> toU64((7 - i) * 8))
    }
  }
}

/** `dst[i] = src[i]` for `i` below `count` and inside both arrays. */
const aesCopyPrefix = (dst: u8[], src: u8[], count: i32): void => {
  const dstLength: i32 = toI32(dst.length)
  const srcLength: i32 = toI32(src.length)
  for (let i: i32 = 0; i < count && i < dstLength && i < srcLength; i++) {
    dst[i] = src[i]
  }
}

/**
 * The first 16 bytes of `block` encrypted, in the first 16 bytes of a fresh
 * batch; the rest of the batch is the cipher of zeros and is not read.
 */
const aesEncryptOne = (key: AesKey, block: u8[]): u8[] => {
  const buf: u8[] = new Array<u8>(AES_BATCH)
  aesCopyPrefix(buf, block, AES_BLOCK)
  aesEncryptBatch(key, buf, new Array<u64>(8))
  return buf
}

/**
 * Makes an `AesKey` from 16 bytes (AES-128) or 32 (AES-256): the key
 * schedule, bitsliced, and H = E(K, 0^128) for GCM. Any other length — 24
 * bytes included, since AES-192 is not offered — answers `null`.
 */
export const aesKey = (key: u8[]): AesKey | null => {
  const length: i32 = toI32(key.length)
  if (length !== 16 && length !== 32) {
    return null
  }
  const rounds: i32 = length === 16 ? 10 : 14
  const expanded: AesKey = new AesKey(rounds, aesExpand(key, rounds))
  const buf: u8[] = aesEncryptOne(expanded, [])
  expanded.hHi = aesLoad64(buf, 0, 8)
  expanded.hLo = aesLoad64(buf, 8, 16)
  return expanded
}

/** One block encrypted (FIPS 197 §5.1, ECB): 16 bytes in, 16 fresh bytes out, or `null` for another length. */
export const aesEncryptBlock = (key: AesKey, block: u8[]): u8[] | null => {
  if (toI32(block.length) !== AES_BLOCK) {
    return null
  }
  const out: u8[] = new Array<u8>(AES_BLOCK)
  aesCopyPrefix(out, aesEncryptOne(key, block), AES_BLOCK)
  return out
}

/**
 * The AES header-protection mask of RFC 9001 §5.4.3: the first five bytes of
 * the 16-byte `sample` encrypted under the header-protection key. `null` for
 * a sample of another length.
 */
export const aesHeaderMask = (key: AesKey, sample: u8[]): u8[] | null => {
  if (toI32(sample.length) !== AES_BLOCK) {
    return null
  }
  const mask: u8[] = new Array<u8>(5)
  aesCopyPrefix(mask, aesEncryptOne(key, sample), 5)
  return mask
}

/*
 * Adapted from BearSSL (https://www.bearssl.org/), src/hash/ghash_ctmul64.c
 * bmul64(). Copyright (c) 2016 Thomas Pornin. Used under the MIT licence;
 * see std/crypto/LICENSE-bearssl.
 */
/**
 * The carry-less product of two 32-bit polynomials, as a 64-bit one. Each
 * operand is split into four with one bit in every four kept, so that an
 * integer product of two parts has at most eight terms at any bit — below 16,
 * so its carries stay inside the three zero bits above it — and the bits of
 * the true product are the low bit of each four, read back through the same
 * masks. Sixteen integer multiplications and no branch.
 */
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

/**
 * GHASH's multiply (SP 800-38D §6.3), `y = y · H` in GF(2^128), with `y` as
 * two words `y[0]` (high) and `y[1]` (low) of the block read big-endian and
 * H likewise in `hHi` and `hLo`.
 *
 * GCM numbers a block's bits from the first, so the block read big-endian is
 * the polynomial with its coefficients reversed. The carry-less product of
 * two reversed polynomials is the reversed product one bit short, so the
 * 256-bit product is shifted left once, and then its low half — the
 * coefficients of x^128 and up — is folded into the high half by
 * x^128 = x^7 + x^2 + x + 1, in two steps because the fold of the lowest
 * seven bits lands back in the low half (Gueron and Kounavis, §4 of the
 * paper cited in the header).
 *
 * The 128 × 128 product is Karatsuba twice over: three 64 × 64 products, each
 * of three 32 × 32 ones from `ghashMul32`. Straight-line code; exported, like
 * `aesBitslicedRound`, so the disassembly check's copy can be held to it.
 */
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

/**
 * Absorbs `data[0 .. length)` into the GHASH state `y`, 16 bytes at a time,
 * the last block padded with zeros (SP 800-38D §6.4, §7.1 step 5).
 */
const ghashUpdate = (y: u64[], key: AesKey, data: u8[], length: i32): void => {
  if (toI32(y.length) < 2) {
    return
  }
  // Counted in blocks rather than stepped by 16, so no offset is ever formed
  // past `length`: an AAD or IV within 16 bytes of 2^31 would overflow `at + 16`.
  const blocks: i32 = (length >> 4) + ((length & 15) !== 0 ? 1 : 0)
  for (let block: i32 = 0; block < blocks; block++) {
    const at: i32 = block * 16
    y[0] = y[0] ^ aesLoad64(data, at, length)
    y[1] = y[1] ^ aesLoad64(data, at + 8, length)
    ghashMultiply(y, key.hHi, key.hLo)
  }
}

/** The last GHASH block: the AAD's and the ciphertext's lengths in bits, 64 bits each. */
const ghashLengths = (y: u64[], key: AesKey, aadLength: i32, textLength: i32): void => {
  y[0] = y[0] ^ (toU64(aadLength) << toU64(3))
  y[1] = y[1] ^ (toU64(textLength) << toU64(3))
  ghashMultiply(y, key.hHi, key.hLo)
}

/**
 * The pre-counter block J0 (SP 800-38D §7.1 step 2): a 12-byte IV followed by
 * the 32-bit counter 1, or for any other length GHASH of the IV padded to a
 * block and followed by its length in bits.
 */
const aesGcmJ0 = (key: AesKey, iv: u8[]): u8[] => {
  const length: i32 = toI32(iv.length)
  const j0: u8[] = new Array<u8>(AES_BLOCK)
  if (length === 12) {
    aesCopyPrefix(j0, iv, 12)
    j0[15] = 1
    return j0
  }
  const y: u64[] = new Array<u64>(2)
  ghashUpdate(y, key, iv, length)
  ghashLengths(y, key, 0, length)
  aesStore64(j0, 0, y[0])
  aesStore64(j0, 8, y[1])
  return j0
}

/**
 * GCTR (SP 800-38D §6.5) from inc32(J0): `dst[i] = src[i] ⊕ keystream[i]` for
 * `i` below `length`, four blocks per pass of the cipher. The counter is the
 * last four bytes of J0 as a big-endian `u32` and wraps modulo 2^32, as
 * inc32 does, while the first twelve bytes stay as they are.
 */
const aesGcmCtr = (key: AesKey, j0: u8[], src: u8[], dst: u8[], length: i32): void => {
  if (toI32(j0.length) < 16) {
    return
  }
  const counter: u32 = aesLoad32(j0, 12)
  const buf: u8[] = new Array<u8>(AES_BATCH)
  const q: u64[] = new Array<u64>(8)
  const srcLength: i32 = toI32(src.length)
  const dstLength: i32 = toI32(dst.length)
  // Counted in batches, like `ghashUpdate`'s blocks, so `base` never passes `length`.
  const batches: i32 = (length >> 6) + ((length & 63) !== 0 ? 1 : 0)
  for (let batch: i32 = 0; batch < batches; batch++) {
    const base: i32 = batch * AES_BATCH
    for (let k: i32 = 0; k < 4; k++) {
      for (let i: i32 = 0; i < 12; i++) {
        buf[16 * k + i] = j0[i]
      }
      aesStore32(buf, 16 * k + 12, counter + toU32((base >> 4) + k + 1))
    }
    aesEncryptBatch(key, buf, q)
    for (let j: i32 = 0; j < AES_BATCH && j < toI32(buf.length); j++) {
      const at: i32 = base + j
      if (at >= 0 && at < length && at < srcLength && at < dstLength) {
        dst[at] = src[at] ^ buf[j]
      }
    }
  }
}

/**
 * E(K, J0) ⊕ S, GCM's tag (SP 800-38D §7.1 step 6), into `y` (zero, two
 * words) as two big-endian words: S is the GHASH of the AAD and the
 * ciphertext `text[0 .. textLength)`.
 */
const aesGcmTag = (y: u64[], key: AesKey, j0: u8[], aad: u8[], text: u8[], textLength: i32): void => {
  const aadLength: i32 = toI32(aad.length)
  ghashUpdate(y, key, aad, aadLength)
  ghashUpdate(y, key, text, textLength)
  ghashLengths(y, key, aadLength, textLength)
  const mask: u8[] = aesEncryptOne(key, j0)
  y[0] = y[0] ^ aesLoad64(mask, 0, 16)
  y[1] = y[1] ^ aesLoad64(mask, 8, 16)
}

/**
 * All-ones when the tag `tagHi:tagLo` equals `gotHi:gotLo`, zero otherwise:
 * the difference of both halves ORed into one word and handed to `ctEq`, so
 * every bit of both tags is read and nothing is branched on until the caller
 * tests the one answer. Exported, like `aesBitslicedRound`, so the
 * disassembly check's copy can be held to it.
 */
export const aesGcmTagMask = (tagHi: u64, tagLo: u64, gotHi: u64, gotLo: u64): u64 =>
  ctEq((tagHi ^ gotHi) | (tagLo ^ gotLo), toU64(0))

/**
 * GCM authenticated encryption (SP 800-38D §7.1): the ciphertext followed by
 * the 16-byte tag, in one fresh array. The IV may be any non-zero length; 12
 * bytes is the fast and usual one. `null` for an empty IV, and for a
 * plaintext longer than 2^31 - 17 bytes, whose sealed form would not fit in an
 * array.
 */
export const aesGcmSeal = (key: AesKey, iv: u8[], aad: u8[], plaintext: u8[]): u8[] | null => {
  const length: i32 = toI32(plaintext.length)
  // 2^31 - 17: the longest plaintext whose sealed form, sixteen bytes longer,
  // is still an array length.
  const longest: i32 = 0x7fffffef
  if (toI32(iv.length) === 0 || length > longest) {
    return null
  }
  const j0: u8[] = aesGcmJ0(key, iv)
  const out: u8[] = new Array<u8>(length + AES_GCM_TAG_SIZE)
  aesGcmCtr(key, j0, plaintext, out, length)
  const tag: u64[] = new Array<u64>(2)
  aesGcmTag(tag, key, j0, aad, out, length)
  aesStore64(out, length, tag[0])
  aesStore64(out, length + 8, tag[1])
  return out
}

/**
 * GCM authenticated decryption (SP 800-38D §7.2): `sealed` is the ciphertext
 * followed by its 16-byte tag, and the answer is the plaintext, or `null` when
 * the tag does not verify, the IV is empty or `sealed` is shorter than a tag.
 * The tag is computed over the received ciphertext and compared in constant
 * time before anything is decrypted, so a forgery yields no plaintext at all.
 */
export const aesGcmOpen = (key: AesKey, iv: u8[], aad: u8[], sealed: u8[]): u8[] | null => {
  const total: i32 = toI32(sealed.length)
  if (toI32(iv.length) === 0 || total < AES_GCM_TAG_SIZE) {
    return null
  }
  // `total` is an array length and at least a tag, so neither this nor the
  // tag's second word at `length + 8` can leave the range of an `i32`.
  const length: i32 = total - AES_GCM_TAG_SIZE
  const j0: u8[] = aesGcmJ0(key, iv)
  const tag: u64[] = new Array<u64>(2)
  aesGcmTag(tag, key, j0, aad, sealed, length)
  const same: u64 = aesGcmTagMask(
    tag[0],
    tag[1],
    aesLoad64(sealed, length, total),
    aesLoad64(sealed, length + 8, total)
  )
  if (same === toU64(0)) {
    return null
  }
  const out: u8[] = new Array<u8>(length)
  aesGcmCtr(key, j0, sealed, out, length)
  return out
}
