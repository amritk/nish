// The differential corpus for ChaCha20's two keystream paths: runtime-chacha20.c's
// kernel (eight blocks at once on AVX2, four on NEON) and
// std/crypto/chacha20poly1305.ts's `chacha20XorInto`, which a program runs
// instead under `NISH_CHACHA20=soft`, on a CPU without AVX2, and for any
// buffer under four blocks. One process takes one path, so the comparison is
// between runs: tests/run.js's "chacha20 kernel" section runs this binary with
// `NISH_CHACHA20` unset and set to `soft` and holds both to `expected.out`,
// which Node's `crypto.createCipheriv("chacha20-poly1305")` and
// `"chacha20"` wrote over the same corpus.
//
// The lengths sit at each boundary the kernel has: under four blocks (the Nish
// path), four, eight and twelve blocks and one byte either side (the four- and
// eight-block loops and the tail's whole and partial blocks), and 16 KiB and
// 64 KiB with a ragged end. Each message is sealed with a seeded key, nonce
// and associated data, opened again, and run through `chacha20` raw from a
// seeded counter. What is printed is one SHA-256 of each sealed message and
// each raw output, so a single wrong byte changes its line.
import { chacha20, chacha20Poly1305Open, chacha20Poly1305Seal } from "nish/crypto/chacha20poly1305";
import { sha256 } from "nish/crypto/sha256";

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
  x: u32 = 20261103;
  next(): u32 {
    let x: u32 = this.x;
    x = x ^ (x << 13);
    x = x ^ (x >>> 17);
    x = x ^ (x << 5);
    this.x = x;
    return x;
  }
  bytes(n: i32): u8[] {
    const out: u8[] = [];
    for (let i: i32 = 0; i < n; i += 1) {
      out.push(toU8(this.next() >>> 24));
    }
    return out;
  }
}

export const main = (): i32 => {
  const rng: Rng = new Rng();
  const lengths: i32[] = [0, 1, 63, 64, 65, 255, 256, 257, 511, 512, 513, 767, 768, 769, 1000, 4096, 16397, 65541];
  for (const n of lengths) {
    const key: u8[] = rng.bytes(32);
    const nonce: u8[] = rng.bytes(12);
    const aad: u8[] = rng.bytes(toI32(rng.next() % 40));
    const plaintext: u8[] = rng.bytes(n);
    const counter: u32 = rng.next() % 1000000;
    const sealed: u8[] | null = chacha20Poly1305Seal(key, nonce, aad, plaintext);
    if (sealed === null) {
      console.log(`FAIL length ${n}: seal refused`);
      return 1;
    }
    const opened: u8[] | null = chacha20Poly1305Open(key, nonce, aad, sealed);
    if (opened === null || hexOf(opened) !== hexOf(plaintext)) {
      console.log(`FAIL length ${n}: open did not give the plaintext back`);
      return 1;
    }
    const raw: u8[] | null = chacha20(key, counter, nonce, plaintext);
    if (raw === null) {
      console.log(`FAIL length ${n}: chacha20 refused`);
      return 1;
    }
    console.log(`${n}: sealed ${hexOf(sha256(sealed))} raw ${hexOf(sha256(raw))}`);
  }
  return 0;
};
