/**
 * `nish/crypto/chacha20poly1305` — the ChaCha20 stream cipher, the Poly1305
 * one-time authenticator and the AEAD built from the two, as RFC 8439 defines
 * them, plus the ChaCha20 header-protection mask of RFC 9001 §5.4.4.
 *
 *     import { chacha20Poly1305Seal, chacha20Poly1305Open } from "nish/crypto/chacha20poly1305";
 *
 *     const sealed: u8[] | null = chacha20Poly1305Seal(key, nonce, aad, plaintext);
 *     const opened: u8[] | null = chacha20Poly1305Open(key, nonce, aad, sealed);
 *
 * A sealed message is the ciphertext followed by the 16-byte tag, the layout
 * TLS 1.3 and QUIC put on the wire. Every function answers `null` for an input
 * of the wrong length, and `chacha20Poly1305Open` answers `null` for a message
 * that does not authenticate; nothing here panics on what a peer sent.
 *
 * Written from the specification (RFC 8439 §2 and RFC 9001 §5.4.4), in this
 * module's own structure: nothing here is ported from another implementation.
 *
 * **ChaCha20** is sixteen `u32` words of additions, rotations and xors, which
 * is constant time as written: `u32` arithmetic wraps by definition, and there
 * is nothing to branch on. The twenty rounds run on locals rather than on an
 * array so that the words stay in registers, and, as RFC 8439 §3 suggests,
 * the state is built once per message and only its counter moves per block.
 *
 * **Poly1305** keeps its accumulator and its key `r` as five limbs of 26 bits
 * each in `u64`, so limb `i` holds bits `26i` to `26i + 25` of a 130-bit
 * number. RFC 8439 §3 asks for constant-time arithmetic without saying how;
 * 26-bit limbs are the common idea for 64-bit multiplies, and they are what
 * makes the arithmetic fit: a limb product is below 2^56, five of them sum
 * below 2^58, and 2^130 = 5 (mod p) folds the top of a product back into the
 * bottom as a multiply by five.
 * `poly1305Block` says why each sum fits. The reduction is by carries and
 * masks, and the final reduction into `[0, p)` picks between `h` and `h - p`
 * with `ctSelect` on a mask made from a borrow, never with a comparison.
 *
 * **Constant time.** Nothing branches on, or indexes by, a key, a keystream
 * word, the accumulator or a tag. Every `if` and every loop bound is on a
 * length, an offset or a block number, all of which the peer already knows.
 * `chacha20Poly1305Open` computes the tag over the received ciphertext and
 * compares all sixteen bytes by ORing their differences into one word before
 * it decrypts anything, and a mismatch is decided on that one word. Verified by
 * disassembly (`tests/cases/ct_asm_chacha20poly1305`, read by
 * `tests/ct-asm.js` for x86-64 and aarch64): the key clamp, one Poly1305 block
 * (the load, the multiply and the partial reduction), the final reduction and
 * the addition of `s`, and the tag compare, each straight-line with no
 * secret-addressed load. The fixture holds copies of those four functions,
 * because the check reads one compiled module; `tests/link/crypto_chacha20poly1305`
 * holds the copies to these originals. The ChaCha20 rounds and the loops that
 * drive both halves are discipline, not proof: the check refuses a loop's own
 * back-edge, so it cannot read them.
 *
 * Private names carry the `chacha20` / `poly1305` prefix because a `std/`
 * module's private functions share the importing program's flat symbol
 * namespace (`docs/wp26-stdlib.md` §3e).
 */

/** The length of a ChaCha20 key in bytes (RFC 8439 §2.3). */
export const CHACHA20_KEY_SIZE: i32 = 32

/** The length of the AEAD's nonce, and of ChaCha20's, in bytes (RFC 8439 §2.3, §2.8). */
export const CHACHA20POLY1305_NONCE_SIZE: i32 = 12

/** The length of a Poly1305 tag in bytes (RFC 8439 §2.5). */
export const POLY1305_TAG_SIZE: i32 = 16

/** The length of a Poly1305 one-time key, `r` then `s`, in bytes (RFC 8439 §2.5). */
export const POLY1305_KEY_SIZE: i32 = 32

/** The length of a ChaCha20 block, and of the keystream one block makes, in bytes. */
export const CHACHA20_BLOCK_SIZE: i32 = 64

/** The length of the header-protection sample in bytes (RFC 9001 §5.4.2). */
export const CHACHA20_HEADER_SAMPLE_SIZE: i32 = 16

/** The length of a header-protection mask in bytes (RFC 9001 §5.4.1). */
export const CHACHA20_HEADER_MASK_SIZE: i32 = 5

/**
 * 2^128 as limb 4 sees it (bit 24 of the limb at bit 104): the one bit a
 * whole 16-byte block gets above its last byte (RFC 8439 §2.5.1's "add one
 * bit beyond the number of octets").
 */
const POLY1305_HIGH_BIT: i32 = 0x1000000

/** `x` rotated left by `n` bits, `n` in 1 to 31. */
const chacha20Rotl = (x: u32, n: u32): u32 => (x << n) | (x >>> (32 - n))

/**
 * The little-endian `u32` at `buf[at]` to `buf[at + 3]`. The offsets are
 * summed in `u32`, which wraps by definition, rather than as checked `i32`
 * sums: every caller passes a window inside `buf`, a wrapped offset would
 * index past it rather than reach another byte, and a check is a branch that
 * `tests/cases/ct_asm_chacha20poly1305` refuses. `poly1305Le64`,
 * `poly1305Block` and `chacha20Poly1305TagMatch` sum theirs the same way.
 */
const chacha20Word = (buf: u8[], at: i32): u32 => {
  const p: u32 = toU32(at)
  return toU32(buf[p]) | (toU32(buf[p + 1]) << 8) | (toU32(buf[p + 2]) << 16) | (toU32(buf[p + 3]) << 24)
}

/**
 * The sixteen-word state of RFC 8439 §2.3: the four constant words
 * ("expand 32-byte k"), the key, the block counter and the nonce, the last
 * read from `nonce[nonceAt]` on so the header mask can take it from its
 * sample in place. The caller has checked every length.
 */
const chacha20State = (key: u8[], counter: u32, nonce: u8[], nonceAt: i32): u32[] => {
  const state: u32[] = new Array<u32>(16)
  state[0] = 0x61707865
  state[1] = 0x3320646e
  state[2] = 0x79622d32
  state[3] = 0x6b206574
  for (let i: i32 = 0; i < 8; i++) {
    state[4 + i] = chacha20Word(key, 4 * i)
  }
  state[12] = counter
  state[13] = chacha20Word(nonce, nonceAt)
  state[14] = chacha20Word(nonce, nonceAt + 4)
  state[15] = chacha20Word(nonce, nonceAt + 8)
  return state
}

/**
 * The ChaCha20 block function (RFC 8439 §2.3) on words: `out` gets the twenty
 * rounds of `state` added to `state`. Ten double rounds, each a column round
 * and a diagonal round of four quarter rounds (§2.1, §2.2), run on sixteen
 * locals so nothing goes back to memory until the end.
 *
 * The early return cannot happen — every state and output is made here with
 * sixteen words — but it is what lets the compiler prove the literal indices
 * below in range and drop their bounds checks.
 */
const chacha20Core = (state: u32[], out: u32[]): void => {
  if (toI32(state.length) < 16 || toI32(out.length) < 16) {
    return
  }
  let x0: u32 = state[0]
  let x1: u32 = state[1]
  let x2: u32 = state[2]
  let x3: u32 = state[3]
  let x4: u32 = state[4]
  let x5: u32 = state[5]
  let x6: u32 = state[6]
  let x7: u32 = state[7]
  let x8: u32 = state[8]
  let x9: u32 = state[9]
  let x10: u32 = state[10]
  let x11: u32 = state[11]
  let x12: u32 = state[12]
  let x13: u32 = state[13]
  let x14: u32 = state[14]
  let x15: u32 = state[15]
  for (let round: i32 = 0; round < 10; round++) {
    // The column round.
    x0 = x0 + x4
    x12 = chacha20Rotl(x12 ^ x0, 16)
    x8 = x8 + x12
    x4 = chacha20Rotl(x4 ^ x8, 12)
    x0 = x0 + x4
    x12 = chacha20Rotl(x12 ^ x0, 8)
    x8 = x8 + x12
    x4 = chacha20Rotl(x4 ^ x8, 7)
    x1 = x1 + x5
    x13 = chacha20Rotl(x13 ^ x1, 16)
    x9 = x9 + x13
    x5 = chacha20Rotl(x5 ^ x9, 12)
    x1 = x1 + x5
    x13 = chacha20Rotl(x13 ^ x1, 8)
    x9 = x9 + x13
    x5 = chacha20Rotl(x5 ^ x9, 7)
    x2 = x2 + x6
    x14 = chacha20Rotl(x14 ^ x2, 16)
    x10 = x10 + x14
    x6 = chacha20Rotl(x6 ^ x10, 12)
    x2 = x2 + x6
    x14 = chacha20Rotl(x14 ^ x2, 8)
    x10 = x10 + x14
    x6 = chacha20Rotl(x6 ^ x10, 7)
    x3 = x3 + x7
    x15 = chacha20Rotl(x15 ^ x3, 16)
    x11 = x11 + x15
    x7 = chacha20Rotl(x7 ^ x11, 12)
    x3 = x3 + x7
    x15 = chacha20Rotl(x15 ^ x3, 8)
    x11 = x11 + x15
    x7 = chacha20Rotl(x7 ^ x11, 7)
    // The diagonal round.
    x0 = x0 + x5
    x15 = chacha20Rotl(x15 ^ x0, 16)
    x10 = x10 + x15
    x5 = chacha20Rotl(x5 ^ x10, 12)
    x0 = x0 + x5
    x15 = chacha20Rotl(x15 ^ x0, 8)
    x10 = x10 + x15
    x5 = chacha20Rotl(x5 ^ x10, 7)
    x1 = x1 + x6
    x12 = chacha20Rotl(x12 ^ x1, 16)
    x11 = x11 + x12
    x6 = chacha20Rotl(x6 ^ x11, 12)
    x1 = x1 + x6
    x12 = chacha20Rotl(x12 ^ x1, 8)
    x11 = x11 + x12
    x6 = chacha20Rotl(x6 ^ x11, 7)
    x2 = x2 + x7
    x13 = chacha20Rotl(x13 ^ x2, 16)
    x8 = x8 + x13
    x7 = chacha20Rotl(x7 ^ x8, 12)
    x2 = x2 + x7
    x13 = chacha20Rotl(x13 ^ x2, 8)
    x8 = x8 + x13
    x7 = chacha20Rotl(x7 ^ x8, 7)
    x3 = x3 + x4
    x14 = chacha20Rotl(x14 ^ x3, 16)
    x9 = x9 + x14
    x4 = chacha20Rotl(x4 ^ x9, 12)
    x3 = x3 + x4
    x14 = chacha20Rotl(x14 ^ x3, 8)
    x9 = x9 + x14
    x4 = chacha20Rotl(x4 ^ x9, 7)
  }
  out[0] = x0 + state[0]
  out[1] = x1 + state[1]
  out[2] = x2 + state[2]
  out[3] = x3 + state[3]
  out[4] = x4 + state[4]
  out[5] = x5 + state[5]
  out[6] = x6 + state[6]
  out[7] = x7 + state[7]
  out[8] = x8 + state[8]
  out[9] = x9 + state[9]
  out[10] = x10 + state[10]
  out[11] = x11 + state[11]
  out[12] = x12 + state[12]
  out[13] = x13 + state[13]
  out[14] = x14 + state[14]
  out[15] = x15 + state[15]
}

/**
 * `dst[dstAt + i] = src[srcAt + i] ^ keystream` for `len` bytes, the keystream
 * running from `state`'s counter on, and the counter left one past the last
 * block used (RFC 8439 §2.4). The caller has checked every window and that
 * the counter does not wrap.
 */
const chacha20XorInto = (state: u32[], src: u8[], srcAt: i32, len: i32, dst: u8[], dstAt: i32): void => {
  const keystream: u32[] = new Array<u32>(16)
  let done: i32 = 0
  while (done < len) {
    chacha20Core(state, keystream)
    state[12] = state[12] + 1
    const take: i32 = len - done < 64 ? len - done : 64
    for (let w: i32 = 0; w < 16 && w < toI32(keystream.length); w++) {
      const word: u32 = keystream[w]
      const at: i32 = done + 4 * w
      if (at + 4 <= done + take) {
        // A whole word, the common case: four bytes with fixed shifts.
        dst[dstAt + at] = src[srcAt + at] ^ toU8(word)
        dst[dstAt + at + 1] = src[srcAt + at + 1] ^ toU8(word >>> 8)
        dst[dstAt + at + 2] = src[srcAt + at + 2] ^ toU8(word >>> 16)
        dst[dstAt + at + 3] = src[srcAt + at + 3] ^ toU8(word >>> 24)
      } else {
        for (let k: i32 = 0; at + k < done + take; k++) {
          dst[dstAt + at + k] = src[srcAt + at + k] ^ toU8(word >>> toU32(8 * k))
        }
      }
    }
    done = done + take
  }
}

/**
 * The one-time key and the ChaCha20 state for the AEAD's payload: block 0
 * of the keystream gives the Poly1305 key (RFC 8439 §2.6), and `state` is
 * left at counter 1, where §2.8 starts the encryption.
 */
const chacha20Poly1305Setup = (state: u32[]): u8[] => {
  const polyKey: u8[] = new Array<u8>(POLY1305_KEY_SIZE)
  chacha20XorInto(state, polyKey, 0, POLY1305_KEY_SIZE, polyKey, 0)
  return polyKey
}

/**
 * Whether the blocks `len` bytes need, from `counter` on, fit before the
 * 32-bit counter wraps.
 * RFC 8439 §2.4 leaves a wrap undefined, and a wrapped counter repeats the
 * keystream, so a request that would need one answers `null` instead. The
 * AEAD asks it too, from counter 1: an array length is below 2^31, so that
 * never refuses today, but the bound is then stated where the counter is
 * rather than left to the width of an array length.
 */
const chacha20CounterFits = (counter: u32, len: i32): boolean => {
  const blocks: i64 = (toI64(len) + toI64(63)) >> toI64(6)
  return toI64(counter) + blocks <= toI64(1) << toI64(32)
}

/**
 * One quarter round (RFC 8439 §2.1, §2.2) on a copy of `state`, at the four
 * word positions `a`, `b`, `c` and `d`, which is what §2.1.1 and §2.2.1 test.
 * `chacha20Core` does the same on locals. Answers `null`
 * when a position is not inside `state`.
 */
export const chacha20QuarterRound = (state: u32[], a: i32, b: i32, c: i32, d: i32): u32[] | null => {
  const n: i32 = toI32(state.length)
  if (a < 0 || a >= n || b < 0 || b >= n || c < 0 || c >= n || d < 0 || d >= n) {
    return null
  }
  const x: u32[] = new Array<u32>(n)
  for (let i: i32 = 0; i < toI32(x.length) && i < toI32(state.length); i++) {
    x[i] = state[i]
  }
  x[a] = x[a] + x[b]
  x[d] = chacha20Rotl(x[d] ^ x[a], 16)
  x[c] = x[c] + x[d]
  x[b] = chacha20Rotl(x[b] ^ x[c], 12)
  x[a] = x[a] + x[b]
  x[d] = chacha20Rotl(x[d] ^ x[a], 8)
  x[c] = x[c] + x[d]
  x[b] = chacha20Rotl(x[b] ^ x[c], 7)
  return x
}

/**
 * The ChaCha20 block function (RFC 8439 §2.3): the 64 bytes of keystream for
 * block `counter` under `key` and `nonce`. Answers `null` unless `key` is
 * `CHACHA20_KEY_SIZE` bytes and `nonce` is `CHACHA20POLY1305_NONCE_SIZE`.
 */
export const chacha20Block = (key: u8[], counter: u32, nonce: u8[]): u8[] | null => {
  if (toI32(key.length) !== CHACHA20_KEY_SIZE || toI32(nonce.length) !== CHACHA20POLY1305_NONCE_SIZE) {
    return null
  }
  const out: u8[] = new Array<u8>(CHACHA20_BLOCK_SIZE)
  chacha20XorInto(chacha20State(key, counter, nonce, 0), out, 0, CHACHA20_BLOCK_SIZE, out, 0)
  return out
}

/**
 * ChaCha20 encryption (RFC 8439 §2.4): `data` xored with the keystream from
 * block `counter` on, which both encrypts and decrypts. Answers `null` unless
 * `key` is `CHACHA20_KEY_SIZE` bytes and `nonce` is
 * `CHACHA20POLY1305_NONCE_SIZE`, and `null` when `data` would run the 32-bit
 * counter past its last value rather than repeat the keystream.
 */
export const chacha20 = (key: u8[], counter: u32, nonce: u8[], data: u8[]): u8[] | null => {
  const len: i32 = toI32(data.length)
  if (
    toI32(key.length) !== CHACHA20_KEY_SIZE ||
    toI32(nonce.length) !== CHACHA20POLY1305_NONCE_SIZE ||
    !chacha20CounterFits(counter, len)
  ) {
    return null
  }
  const out: u8[] = new Array<u8>(len)
  chacha20XorInto(chacha20State(key, counter, nonce, 0), data, 0, len, out, 0)
  return out
}

/** The little-endian `u64` at `buf[at]` to `buf[at + 7]`. */
const poly1305Le64 = (buf: u8[], at: i32): u64 => {
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

/**
 * `r` from the first 16 bytes of a one-time key, clamped as RFC 8439 §2.5
 * says (the top four bits of bytes 3, 7, 11 and 15 and the bottom two of
 * bytes 4, 8 and 12 cleared), into the five limbs of `r`.
 *
 * Straight-line and without a length check so that
 * `tests/cases/ct_asm_chacha20poly1305` can hold a copy of it to the
 * disassembly check; every caller passes a 32-byte key and a 5-limb `r`.
 */
const poly1305Clamp = (key: u8[], r: u64[]): void => {
  const lo: u64 = poly1305Le64(key, 0) & ((toU64(0x0ffffffc) << 32) | 0x0fffffff)
  const hi: u64 = poly1305Le64(key, 8) & ((toU64(0x0ffffffc) << 32) | 0x0ffffffc)
  r[0] = lo & 0x3ffffff
  r[1] = (lo >>> 26) & 0x3ffffff
  r[2] = ((lo >>> 52) | (hi << 12)) & 0x3ffffff
  r[3] = (hi >>> 14) & 0x3ffffff
  r[4] = hi >>> 40
}

/**
 * One Poly1305 step (RFC 8439 §2.5.1): `h = (h + block) * r mod p`, the block
 * the 16 bytes at `m[at]` plus `high` at bit 128, reduced only far enough for
 * the next step. `high` is `POLY1305_HIGH_BIT` for a whole block and for an
 * AEAD's zero-padded one, and zero for §2.5.1's short last block, whose 0x01
 * byte is already inside the sixteen.
 *
 * **Why the sums fit in `u64`.** On entry every limb of `h` is below
 * 2^26 + 2^9 — what the last step's carries leave — and adding the block,
 * whose limbs are below 2^26 and whose top limb is below 2^25, keeps each
 * below 2^27.01. The clamped `r` has limbs below 2^26, and `5 * r` below
 * 2^28.33. A product is therefore below 2^55.34 and each `d` is five of them,
 * below 2^57.66. The carries out of `d` are below 2^31.7, `5 *` the one out of
 * limb 4 is below 2^34.1, and what carries on from limb 0 into limb 1 is
 * below 2^9, which is the entry bound again.
 *
 * Straight-line and without a length check so that
 * `tests/cases/ct_asm_chacha20poly1305` can hold a copy of it to the
 * disassembly check; every caller passes 5-limb arrays and a window of 16.
 */
const poly1305Block = (h: u64[], r: u64[], m: u8[], at: i32, high: u64): void => {
  const lo: u64 = poly1305Le64(m, at)
  const hi: u64 = poly1305Le64(m, toI32(toU32(at) + 8))
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

/**
 * The tag (RFC 8439 §2.5.1): `h` reduced into `[0, p)`, plus `s` (bytes 16 to
 * 31 of the one-time key) modulo 2^128, as 16 little-endian bytes into `tag`.
 *
 * Two carry passes make every limb below 2^26: the first leaves limb 0 at most
 * 2^26 + 4, the second carries at most one bit all the way up, and a carry
 * out of limb 4 then leaves limb 0 below ten. So `h` is below 2^130, which is
 * `[0, p)` or `[p, 2^130)`. `g = h + 5 - 2^130` is `h - p`, and it has no
 * borrow out of its top limb exactly when `h >= p`: the borrow's sign bit
 * becomes an all-zeros or all-ones mask, and `ctSelect` keeps `g` or `h`
 * limb by limb without a comparison. Adding `s` runs in 32-bit words with the
 * carry in the upper half of a `u64`, so there is no compare there either.
 *
 * Straight-line and without a length check so that
 * `tests/cases/ct_asm_chacha20poly1305` can hold a copy of it to the
 * disassembly check; every caller passes a 5-limb `h`, a 32-byte key and a
 * 16-byte `tag`.
 */
const poly1305Finish = (h: u64[], key: u8[], tag: u8[]): void => {
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
  let f: u64 = ((h0 | (h1 << 26)) & word) + toU64(chacha20Word(key, 16))
  tag[0] = toU8(f)
  tag[1] = toU8(f >>> 8)
  tag[2] = toU8(f >>> 16)
  tag[3] = toU8(f >>> 24)
  f = (((h1 >>> 6) | (h2 << 20)) & word) + toU64(chacha20Word(key, 20)) + (f >>> 32)
  tag[4] = toU8(f)
  tag[5] = toU8(f >>> 8)
  tag[6] = toU8(f >>> 16)
  tag[7] = toU8(f >>> 24)
  f = (((h2 >>> 12) | (h3 << 14)) & word) + toU64(chacha20Word(key, 24)) + (f >>> 32)
  tag[8] = toU8(f)
  tag[9] = toU8(f >>> 8)
  tag[10] = toU8(f >>> 16)
  tag[11] = toU8(f >>> 24)
  f = (((h3 >>> 18) | (h4 << 8)) & word) + toU64(chacha20Word(key, 28)) + (f >>> 32)
  tag[12] = toU8(f)
  tag[13] = toU8(f >>> 8)
  tag[14] = toU8(f >>> 16)
  tag[15] = toU8(f >>> 24)
}

/**
 * Feeds the `len` bytes of `buf` from `at` to the accumulator `h`, sixteen at
 * a time. A short last block is padded one of two ways: `zeroPad` is the
 * AEAD's (RFC 8439 §2.8, zeros up to 16 bytes and the block counted as whole),
 * and otherwise it is §2.5.1's, a 0x01 byte after the message and zeros after
 * that, with no bit at 2^128.
 */
const poly1305Absorb = (h: u64[], r: u64[], buf: u8[], at: i32, len: i32, zeroPad: boolean): void => {
  const whole: i32 = len >> 4
  for (let i: i32 = 0; i < whole; i++) {
    poly1305Block(h, r, buf, at + 16 * i, toU64(POLY1305_HIGH_BIT))
  }
  const tail: i32 = len & 15
  if (tail > 0) {
    const last: u8[] = new Array<u8>(16)
    for (let i: i32 = 0; i < tail && i < toI32(last.length); i++) {
      last[i] = buf[at + 16 * whole + i]
    }
    if (zeroPad) {
      poly1305Block(h, r, last, 0, toU64(POLY1305_HIGH_BIT))
    } else {
      last[tail] = 1
      poly1305Block(h, r, last, 0, 0)
    }
  }
}

/**
 * Poly1305 (RFC 8439 §2.5): the 16-byte tag of `msg` under the one-time key
 * `key`, `r` then `s`. A key must never authenticate two messages; the AEAD
 * below makes a fresh one per nonce. Answers `null` unless `key` is
 * `POLY1305_KEY_SIZE` bytes.
 */
export const poly1305 = (key: u8[], msg: u8[]): u8[] | null => {
  if (toI32(key.length) !== POLY1305_KEY_SIZE) {
    return null
  }
  const h: u64[] = new Array<u64>(5)
  const r: u64[] = new Array<u64>(5)
  poly1305Clamp(key, r)
  poly1305Absorb(h, r, msg, 0, toI32(msg.length), false)
  const tag: u8[] = new Array<u8>(POLY1305_TAG_SIZE)
  poly1305Finish(h, key, tag)
  return tag
}

/**
 * The Poly1305 one-time key of RFC 8439 §2.6: the first 32 bytes of the
 * ChaCha20 block with counter 0 under the AEAD's key and nonce. Answers
 * `null` unless `key` is `CHACHA20_KEY_SIZE` bytes and `nonce` is
 * `CHACHA20POLY1305_NONCE_SIZE`.
 */
export const poly1305KeyGen = (key: u8[], nonce: u8[]): u8[] | null => {
  if (toI32(key.length) !== CHACHA20_KEY_SIZE || toI32(nonce.length) !== CHACHA20POLY1305_NONCE_SIZE) {
    return null
  }
  return chacha20Poly1305Setup(chacha20State(key, 0, nonce, 0))
}

/**
 * The AEAD tag of RFC 8439 §2.8 over `aad` and the `len` bytes of ciphertext
 * at `ct[at]`: Poly1305 under `polyKey` of the AAD and the ciphertext, each
 * zero-padded to 16 bytes, and then both lengths as little-endian `u64`s.
 */
const chacha20Poly1305Tag = (polyKey: u8[], aad: u8[], ct: u8[], at: i32, len: i32): u8[] => {
  const aadLen: i32 = toI32(aad.length)
  const h: u64[] = new Array<u64>(5)
  const r: u64[] = new Array<u64>(5)
  poly1305Clamp(polyKey, r)
  poly1305Absorb(h, r, aad, 0, aadLen, true)
  poly1305Absorb(h, r, ct, at, len, true)
  const lengths: u8[] = new Array<u8>(16)
  for (let i: i32 = 0; i < 4; i++) {
    lengths[i] = toU8(aadLen >>> (8 * i))
    lengths[8 + i] = toU8(len >>> (8 * i))
  }
  poly1305Block(h, r, lengths, 0, toU64(POLY1305_HIGH_BIT))
  const tag: u8[] = new Array<u8>(POLY1305_TAG_SIZE)
  poly1305Finish(h, polyKey, tag)
  return tag
}

/**
 * All ones when the 16 bytes of `tag` equal the 16 at `sealed[at]`, zero
 * otherwise. Every pair is read, the differences are ORed into one word, and
 * `ctEq` turns that word into the answer, so nothing depends on where the
 * first difference is.
 *
 * Written out byte by byte and without a length check so that `tests/cases/ct_asm_chacha20poly1305` can hold a copy of it to the
 * disassembly check; the caller has checked that `sealed` holds the window.
 */
const chacha20Poly1305TagMatch = (tag: u8[], sealed: u8[], at: i32): u32 => {
  const p: u32 = toU32(at)
  const diff: u32 =
    toU32(tag[0] ^ sealed[p]) |
    toU32(tag[1] ^ sealed[p + 1]) |
    toU32(tag[2] ^ sealed[p + 2]) |
    toU32(tag[3] ^ sealed[p + 3]) |
    toU32(tag[4] ^ sealed[p + 4]) |
    toU32(tag[5] ^ sealed[p + 5]) |
    toU32(tag[6] ^ sealed[p + 6]) |
    toU32(tag[7] ^ sealed[p + 7]) |
    toU32(tag[8] ^ sealed[p + 8]) |
    toU32(tag[9] ^ sealed[p + 9]) |
    toU32(tag[10] ^ sealed[p + 10]) |
    toU32(tag[11] ^ sealed[p + 11]) |
    toU32(tag[12] ^ sealed[p + 12]) |
    toU32(tag[13] ^ sealed[p + 13]) |
    toU32(tag[14] ^ sealed[p + 14]) |
    toU32(tag[15] ^ sealed[p + 15])
  return ctEq(diff, 0)
}

/**
 * AEAD_CHACHA20_POLY1305 encryption (RFC 8439 §2.8): the ciphertext of
 * `plaintext` followed by the 16-byte tag over it and `aad`. A nonce must
 * never be used twice with one key. Answers `null` unless `key` is
 * `CHACHA20_KEY_SIZE` bytes and `nonce` is `CHACHA20POLY1305_NONCE_SIZE`, or
 * when the sealed message would not fit in an array.
 */
export const chacha20Poly1305Seal = (key: u8[], nonce: u8[], aad: u8[], plaintext: u8[]): u8[] | null => {
  const len: i32 = toI32(plaintext.length)
  // 2^31 - 17: the longest plaintext whose sealed form, sixteen bytes longer,
  // is still an array length.
  const longest: i32 = 0x7fffffef
  if (
    toI32(key.length) !== CHACHA20_KEY_SIZE ||
    toI32(nonce.length) !== CHACHA20POLY1305_NONCE_SIZE ||
    len > longest ||
    !chacha20CounterFits(1, len)
  ) {
    return null
  }
  const state: u32[] = chacha20State(key, 0, nonce, 0)
  const polyKey: u8[] = chacha20Poly1305Setup(state)
  const sealed: u8[] = new Array<u8>(len + POLY1305_TAG_SIZE)
  chacha20XorInto(state, plaintext, 0, len, sealed, 0)
  const tag: u8[] = chacha20Poly1305Tag(polyKey, aad, sealed, 0, len)
  for (let i: i32 = 0; i < toI32(tag.length); i++) {
    sealed[len + i] = tag[i]
  }
  return sealed
}

/**
 * AEAD_CHACHA20_POLY1305 decryption (RFC 8439 §2.8): the plaintext of
 * `sealed`, ciphertext then tag, when the tag authenticates it and `aad`.
 *
 * The tag is computed over the received ciphertext and compared in constant
 * time before a byte is decrypted, so a forgery gets `null` and nothing else.
 * Answers `null` too unless `key` is `CHACHA20_KEY_SIZE` bytes and `nonce` is
 * `CHACHA20POLY1305_NONCE_SIZE`, and when `sealed` is shorter than a tag.
 */
export const chacha20Poly1305Open = (key: u8[], nonce: u8[], aad: u8[], sealed: u8[]): u8[] | null => {
  const total: i32 = toI32(sealed.length)
  if (
    toI32(key.length) !== CHACHA20_KEY_SIZE ||
    toI32(nonce.length) !== CHACHA20POLY1305_NONCE_SIZE ||
    total < POLY1305_TAG_SIZE
  ) {
    return null
  }
  const len: i32 = total - POLY1305_TAG_SIZE
  if (!chacha20CounterFits(1, len)) {
    return null
  }
  const state: u32[] = chacha20State(key, 0, nonce, 0)
  const polyKey: u8[] = chacha20Poly1305Setup(state)
  const tag: u8[] = chacha20Poly1305Tag(polyKey, aad, sealed, 0, len)
  // The one branch on the comparison, and it is on the answer the caller is
  // about to learn anyway.
  if (chacha20Poly1305TagMatch(tag, sealed, len) === 0) {
    return null
  }
  const plaintext: u8[] = new Array<u8>(len)
  chacha20XorInto(state, sealed, 0, len, plaintext, 0)
  return plaintext
}

/**
 * The ChaCha20 header-protection mask of RFC 9001 §5.4.4: the first five
 * bytes of the keystream block whose counter is the first four bytes of
 * `sample` (little-endian) and whose nonce is the other twelve, under the
 * header-protection key `hpKey`. Answers `null` unless `hpKey` is
 * `CHACHA20_KEY_SIZE` bytes and `sample` is `CHACHA20_HEADER_SAMPLE_SIZE`.
 */
export const chacha20HeaderMask = (hpKey: u8[], sample: u8[]): u8[] | null => {
  if (toI32(hpKey.length) !== CHACHA20_KEY_SIZE || toI32(sample.length) !== CHACHA20_HEADER_SAMPLE_SIZE) {
    return null
  }
  const mask: u8[] = new Array<u8>(CHACHA20_HEADER_MASK_SIZE)
  chacha20XorInto(chacha20State(hpKey, chacha20Word(sample, 0), sample, 4), mask, 0, 5, mask, 0)
  return mask
}
