// The ChaCha20 block permutation (RFC 8439 §2.3: ten double rounds of the
// quarter-round, no feed-forward add) over four blocks at once, written with
// nish:simd's addWrapping, xor and rotl: the add-rotate-xor kernel WP38 S3's
// shifts and rotates are for (docs/wp38-simd.md §3.2). The state is 64 words,
// word w of block b at s[4 * w + b], so one u32x4 load reads word w of all
// four blocks and lane b is block b. ITER passes, then the xor of every word,
// the checksum chacha-scalar.ts prints too. Timed by bench/simd-arx.mjs.
import { u32x4, loadU32x4, store, addWrapping, xor, rotl } from "nish:simd"

const ITER: i32 = 2000000

const permute = (s: u32[]): void => {
  let x0: u32x4 = loadU32x4(s, 0)
  let x1: u32x4 = loadU32x4(s, 4)
  let x2: u32x4 = loadU32x4(s, 8)
  let x3: u32x4 = loadU32x4(s, 12)
  let x4: u32x4 = loadU32x4(s, 16)
  let x5: u32x4 = loadU32x4(s, 20)
  let x6: u32x4 = loadU32x4(s, 24)
  let x7: u32x4 = loadU32x4(s, 28)
  let x8: u32x4 = loadU32x4(s, 32)
  let x9: u32x4 = loadU32x4(s, 36)
  let x10: u32x4 = loadU32x4(s, 40)
  let x11: u32x4 = loadU32x4(s, 44)
  let x12: u32x4 = loadU32x4(s, 48)
  let x13: u32x4 = loadU32x4(s, 52)
  let x14: u32x4 = loadU32x4(s, 56)
  let x15: u32x4 = loadU32x4(s, 60)
  for (let r: i32 = 0; r < 10; r++) {
    x0 = addWrapping(x0, x4)
    x12 = rotl(xor(x12, x0), 16)
    x8 = addWrapping(x8, x12)
    x4 = rotl(xor(x4, x8), 12)
    x0 = addWrapping(x0, x4)
    x12 = rotl(xor(x12, x0), 8)
    x8 = addWrapping(x8, x12)
    x4 = rotl(xor(x4, x8), 7)
    x1 = addWrapping(x1, x5)
    x13 = rotl(xor(x13, x1), 16)
    x9 = addWrapping(x9, x13)
    x5 = rotl(xor(x5, x9), 12)
    x1 = addWrapping(x1, x5)
    x13 = rotl(xor(x13, x1), 8)
    x9 = addWrapping(x9, x13)
    x5 = rotl(xor(x5, x9), 7)
    x2 = addWrapping(x2, x6)
    x14 = rotl(xor(x14, x2), 16)
    x10 = addWrapping(x10, x14)
    x6 = rotl(xor(x6, x10), 12)
    x2 = addWrapping(x2, x6)
    x14 = rotl(xor(x14, x2), 8)
    x10 = addWrapping(x10, x14)
    x6 = rotl(xor(x6, x10), 7)
    x3 = addWrapping(x3, x7)
    x15 = rotl(xor(x15, x3), 16)
    x11 = addWrapping(x11, x15)
    x7 = rotl(xor(x7, x11), 12)
    x3 = addWrapping(x3, x7)
    x15 = rotl(xor(x15, x3), 8)
    x11 = addWrapping(x11, x15)
    x7 = rotl(xor(x7, x11), 7)
    x0 = addWrapping(x0, x5)
    x15 = rotl(xor(x15, x0), 16)
    x10 = addWrapping(x10, x15)
    x5 = rotl(xor(x5, x10), 12)
    x0 = addWrapping(x0, x5)
    x15 = rotl(xor(x15, x0), 8)
    x10 = addWrapping(x10, x15)
    x5 = rotl(xor(x5, x10), 7)
    x1 = addWrapping(x1, x6)
    x12 = rotl(xor(x12, x1), 16)
    x11 = addWrapping(x11, x12)
    x6 = rotl(xor(x6, x11), 12)
    x1 = addWrapping(x1, x6)
    x12 = rotl(xor(x12, x1), 8)
    x11 = addWrapping(x11, x12)
    x6 = rotl(xor(x6, x11), 7)
    x2 = addWrapping(x2, x7)
    x13 = rotl(xor(x13, x2), 16)
    x8 = addWrapping(x8, x13)
    x7 = rotl(xor(x7, x8), 12)
    x2 = addWrapping(x2, x7)
    x13 = rotl(xor(x13, x2), 8)
    x8 = addWrapping(x8, x13)
    x7 = rotl(xor(x7, x8), 7)
    x3 = addWrapping(x3, x4)
    x14 = rotl(xor(x14, x3), 16)
    x9 = addWrapping(x9, x14)
    x4 = rotl(xor(x4, x9), 12)
    x3 = addWrapping(x3, x4)
    x14 = rotl(xor(x14, x3), 8)
    x9 = addWrapping(x9, x14)
    x4 = rotl(xor(x4, x9), 7)
  }
  store(x0, s, 0)
  store(x1, s, 4)
  store(x2, s, 8)
  store(x3, s, 12)
  store(x4, s, 16)
  store(x5, s, 20)
  store(x6, s, 24)
  store(x7, s, 28)
  store(x8, s, 32)
  store(x9, s, 36)
  store(x10, s, 40)
  store(x11, s, 44)
  store(x12, s, 48)
  store(x13, s, 52)
  store(x14, s, 56)
  store(x15, s, 60)
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
