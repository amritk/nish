// Crypto K1: `nish/crypto/ct`'s compare loops under the assembly check in
// tests/run.js. The check refuses every conditional branch, and both functions
// in std/crypto/ct.ts branch on their public lengths — a length test first and
// a loop whose trip count is the length — so neither can be read as it stands.
// What can be is the loop each is built on, at the lengths a verifier uses: the
// accumulation of `timingSafeEqual`, verbatim, at HMAC-SHA-256's 32-byte and
// HMAC-SHA-384's 48-byte tags, and that of `timingSafeEqualAt` over a 16-byte
// window at public offsets (an AEAD tag inside a record). Each keeps the
// module's shape: an `i32` accumulator, and a boolean `diff === 0` read once,
// after the loop. That boolean is where LLVM could have turned the reduction
// back into an early exit, and this is what shows it has not; `ct_asm_mac`'s
// `macEqual` is the same loop answering a mask instead.
//
// The bytes are secret; `aOff` and `bOff` are public, as the module says.
// Indexing is unchecked (ct_asm_k1_ct.args), since a bounds check is a branch.
// tests/link/crypto_ct_k1_copies holds each function to the module on
// generated inputs, so a copy that drifts from std/crypto/ct.ts fails there.
// ct-check: timingSafeEqual32 secret=contents
// ct-check: timingSafeEqual48 secret=contents
// ct-check: timingSafeEqualAt16 secret=contents

// `timingSafeEqual`'s loop and answer, for two 32-byte arrays.
export const timingSafeEqual32 = (a: u8[], b: u8[]): boolean => {
  let diff: i32 = 0
  for (let i: i32 = 0; i < 32; i++) {
    diff = diff | toI32(a[i] ^ b[i])
  }
  return diff === 0
}

// `timingSafeEqual`'s loop and answer, for two 48-byte arrays.
export const timingSafeEqual48 = (a: u8[], b: u8[]): boolean => {
  let diff: i32 = 0
  for (let i: i32 = 0; i < 48; i++) {
    diff = diff | toI32(a[i] ^ b[i])
  }
  return diff === 0
}

// `timingSafeEqualAt`'s loop and answer, for a 16-byte window of each array.
export const timingSafeEqualAt16 = (a: u8[], aOff: i32, b: u8[], bOff: i32): boolean => {
  let diff: i32 = 0
  for (let k: i32 = 0; k < 16; k++) {
    diff = diff | toI32(a[aOff + k] ^ b[bOff + k])
  }
  return diff === 0
}
