/**
 * `nish/crypto/ct` — comparing secrets without telling the clock where they differ.
 *
 * An `===` loop over two MACs stops at the first differing byte, so the time it
 * takes says how many leading bytes an attacker already guessed right, and a
 * tag can be recovered one byte at a time. These functions read every byte of
 * the window whatever it holds: each pair is XORed, the differences are ORed
 * into one accumulator, and that accumulator is tested once, after the loop.
 *
 * What is *not* secret is checked first and may branch: the two lengths, and
 * whether a window lies inside its array. A caller comparing a received tag
 * against an expected one already knows both lengths, so refusing a mismatch
 * early leaks nothing the attacker did not send.
 *
 * The names are `timingSafeEqual*`, after Node's `crypto.timingSafeEqual`,
 * rather than `ctEq`: that one is reserved for the builtin WP34 N6 will add,
 * together with the disassembly check that proves the loop stays branch-free
 * after LLVM has seen it. Until then this is the discipline and not a proof.
 */

/**
 * Whether `a` and `b` hold the same bytes, reading all of them.
 *
 * Arrays of different lengths answer `false` at once, because a length is
 * public; arrays of one length are compared in full, with no early exit.
 */
export const timingSafeEqual = (a: u8[], b: u8[]): boolean => {
  const n: i32 = toI32(a.length)
  if (n !== toI32(b.length)) {
    return false
  }
  let diff: i32 = 0
  // Bounded by both lengths, which are equal here, so the prover drops both
  // bounds checks rather than trusting the comparison above.
  for (let i: i32 = 0; i < n && i < toI32(b.length); i++) {
    diff = diff | toI32(a[i] ^ b[i])
  }
  return diff === 0
}

/**
 * Whether the `len` bytes of `a` from `aOff` equal the `len` bytes of `b` from
 * `bOff`, reading all of them.
 *
 * A window that does not lie inside its array — a negative offset or length,
 * or `off + len` past the end — answers `false` instead of panicking on the
 * first out-of-range read. That is a decision about the caller's position: a
 * verifier handed a truncated record should say "not equal", not take the
 * process down, and the bounds are public, so testing them first is safe.
 */
export const timingSafeEqualAt = (a: u8[], aOff: i32, b: u8[], bOff: i32, len: i32): boolean => {
  const aLen: i32 = toI32(a.length)
  const bLen: i32 = toI32(b.length)
  // Written as `off > length - len` rather than `off + len > length`, so that
  // a huge offset cannot wrap round to a small sum and pass.
  if (aOff < 0 || bOff < 0 || len < 0 || aOff > aLen - len || bOff > bLen - len) {
    return false
  }
  let diff: i32 = 0
  for (let k: i32 = 0; k < len; k++) {
    diff = diff | toI32(a[aOff + k] ^ b[bOff + k])
  }
  return diff === 0
}
