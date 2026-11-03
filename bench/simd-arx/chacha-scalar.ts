// The ChaCha20 block permutation (RFC 8439 §2.3: ten double rounds of the
// quarter-round, no feed-forward add) over four blocks, in scalar Nish: the
// comparator of chacha-simd.ts, the add-rotate-xor kernel WP38 S3's shifts and
// rotates are for (docs/wp38-simd.md §3.2). The state is 64 words, word w of
// block b at s[4 * w + b], as chacha-simd.ts keeps it. Each block is permuted
// in sixteen u32 locals, whose + wraps as a vector lane's does; a rotate is
// two shifts and an or, which LLVM turns into a rotate. ITER passes, then the
// xor of every word, the checksum both forms print. Timed by bench/simd-arx.mjs.
const ITER: i32 = 2000000

const rotl32 = (x: u32, k: u32): u32 => (x << k) | (x >>> (32 - k))

const permute = (s: u32[]): void => {
  for (let b: i32 = 0; b < 4 && 60 + b < s.length; b++) {
    let x0: u32 = s[0 + b]
    let x1: u32 = s[4 + b]
    let x2: u32 = s[8 + b]
    let x3: u32 = s[12 + b]
    let x4: u32 = s[16 + b]
    let x5: u32 = s[20 + b]
    let x6: u32 = s[24 + b]
    let x7: u32 = s[28 + b]
    let x8: u32 = s[32 + b]
    let x9: u32 = s[36 + b]
    let x10: u32 = s[40 + b]
    let x11: u32 = s[44 + b]
    let x12: u32 = s[48 + b]
    let x13: u32 = s[52 + b]
    let x14: u32 = s[56 + b]
    let x15: u32 = s[60 + b]
    for (let r: i32 = 0; r < 10; r++) {
      x0 = x0 + x4
      x12 = rotl32(x12 ^ x0, 16)
      x8 = x8 + x12
      x4 = rotl32(x4 ^ x8, 12)
      x0 = x0 + x4
      x12 = rotl32(x12 ^ x0, 8)
      x8 = x8 + x12
      x4 = rotl32(x4 ^ x8, 7)
      x1 = x1 + x5
      x13 = rotl32(x13 ^ x1, 16)
      x9 = x9 + x13
      x5 = rotl32(x5 ^ x9, 12)
      x1 = x1 + x5
      x13 = rotl32(x13 ^ x1, 8)
      x9 = x9 + x13
      x5 = rotl32(x5 ^ x9, 7)
      x2 = x2 + x6
      x14 = rotl32(x14 ^ x2, 16)
      x10 = x10 + x14
      x6 = rotl32(x6 ^ x10, 12)
      x2 = x2 + x6
      x14 = rotl32(x14 ^ x2, 8)
      x10 = x10 + x14
      x6 = rotl32(x6 ^ x10, 7)
      x3 = x3 + x7
      x15 = rotl32(x15 ^ x3, 16)
      x11 = x11 + x15
      x7 = rotl32(x7 ^ x11, 12)
      x3 = x3 + x7
      x15 = rotl32(x15 ^ x3, 8)
      x11 = x11 + x15
      x7 = rotl32(x7 ^ x11, 7)
      x0 = x0 + x5
      x15 = rotl32(x15 ^ x0, 16)
      x10 = x10 + x15
      x5 = rotl32(x5 ^ x10, 12)
      x0 = x0 + x5
      x15 = rotl32(x15 ^ x0, 8)
      x10 = x10 + x15
      x5 = rotl32(x5 ^ x10, 7)
      x1 = x1 + x6
      x12 = rotl32(x12 ^ x1, 16)
      x11 = x11 + x12
      x6 = rotl32(x6 ^ x11, 12)
      x1 = x1 + x6
      x12 = rotl32(x12 ^ x1, 8)
      x11 = x11 + x12
      x6 = rotl32(x6 ^ x11, 7)
      x2 = x2 + x7
      x13 = rotl32(x13 ^ x2, 16)
      x8 = x8 + x13
      x7 = rotl32(x7 ^ x8, 12)
      x2 = x2 + x7
      x13 = rotl32(x13 ^ x2, 8)
      x8 = x8 + x13
      x7 = rotl32(x7 ^ x8, 7)
      x3 = x3 + x4
      x14 = rotl32(x14 ^ x3, 16)
      x9 = x9 + x14
      x4 = rotl32(x4 ^ x9, 12)
      x3 = x3 + x4
      x14 = rotl32(x14 ^ x3, 8)
      x9 = x9 + x14
      x4 = rotl32(x4 ^ x9, 7)
    }
    if (60 + b < s.length) {
      s[0 + b] = x0
      s[4 + b] = x1
      s[8 + b] = x2
      s[12 + b] = x3
      s[16 + b] = x4
      s[20 + b] = x5
      s[24 + b] = x6
      s[28 + b] = x7
      s[32 + b] = x8
      s[36 + b] = x9
      s[40 + b] = x10
      s[44 + b] = x11
      s[48 + b] = x12
      s[52 + b] = x13
      s[56 + b] = x14
      s[60 + b] = x15
    }
  }
}

export const main = (): i32 => {
  const s: u32[] = []
  for (let i: i32 = 0; i < 64; i++) {
    s.push(toU32(i) * 0x9e3779b9)
  }
  for (let n: i32 = 0; n < ITER; n++) {
    permute(s)
  }
  let sum: u32 = 0
  for (let i: i32 = 0; i < s.length; i++) {
    sum = sum ^ s[i]
  }
  console.log(sum)
  return 0
}
