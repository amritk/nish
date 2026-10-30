// The differential corpus for SHA-256's two block paths: runtime-sha256.c's
// kernel (SHA-NI, or the ARMv8 SHA-256 instructions) and std/crypto/sha256.ts's
// `sha256Compress`, which a program runs instead under `NISH_SHA256=soft` or on
// a CPU without them. One process takes one path, so the comparison is between
// runs: tests/run.js's "sha256 kernel" section runs this binary with
// `NISH_SHA256` unset and set to `soft` and holds both to `expected.out`, which
// was written by Node's `crypto.createHash("sha256")` over the same corpus.
//
// The messages are every length 0..200 (one block, two, and every padding
// boundary between), every length 4032..4096 (the end of a 64-block message,
// where the last block is whole or ragged), and 100 seeded lengths between.
// Each is hashed once whole and once streamed in seeded pieces of 0..130 bytes,
// so `update` both tops up a partial block and compresses whole blocks straight
// out of the caller's buffer at an offset that is not a multiple of 64; the
// two digests must agree. What is printed is the count and one SHA-256 over
// every digest in order, so a single wrong block anywhere changes the line.
import { Sha256, sha256 } from "nish/crypto/sha256";

const HEX_DIGITS: string = "0123456789abcdef";

const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** Marsaglia's xorshift32, the same steps as the generator that wrote expected.out. */
class Rng {
  x: u32 = 20261030;
  next(): u32 {
    let x: u32 = this.x;
    x = x ^ (x << 13);
    x = x ^ (x >>> 17);
    x = x ^ (x << 5);
    this.x = x;
    return x;
  }
  /** A value in 0 .. bound - 1. */
  below(bound: i32): i32 {
    return toI32(this.next() % toU32(bound));
  }
}

export const main = (): i32 => {
  const rng: Rng = new Rng();
  const lengths: i32[] = [];
  for (let n: i32 = 0; n <= 200; n += 1) {
    lengths.push(n);
  }
  for (let i: i32 = 0; i < 100; i += 1) {
    lengths.push(201 + rng.below(4032 - 201));
  }
  for (let n: i32 = 4032; n <= 4096; n += 1) {
    lengths.push(n);
  }
  const all: Sha256 = new Sha256();
  let count: i32 = 0;
  for (const n of lengths) {
    const msg: u8[] = [];
    for (let i: i32 = 0; i < n; i += 1) {
      msg.push(toU8(rng.next() >>> 24));
    }
    const whole: u8[] = sha256(msg);
    const pieces: Sha256 = new Sha256();
    let at: i32 = 0;
    while (at < n) {
      let take: i32 = rng.below(131);
      if (take > n - at) {
        take = n - at;
      }
      pieces.update(msg, at, take);
      at += take;
    }
    const streamed: u8[] = pieces.digest();
    if (hexOf(whole) !== hexOf(streamed)) {
      console.log(`FAIL length ${n}: whole ${hexOf(whole)}, streamed ${hexOf(streamed)}`);
      return 1;
    }
    all.update(whole, 0, 32);
    count += 1;
  }
  console.log(`${count} messages, each streamed in seeded pieces, agree whole and in pieces`);
  console.log(`sha256 of every digest: ${hexOf(all.digest())}`);
  return 0;
};
