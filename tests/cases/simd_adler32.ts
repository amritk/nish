// Adler-32 two ways over the same buffers: the scalar byte-at-a-time loop, and
// a lane-wise loop that folds sixteen bytes per step. For a block x0..x15 the
// running sums move as a += x0 + ... + x15 and b += 16a + 16*x0 + 15*x1 + ...
// + 1*x15. The bytes are widened to two u16x8 halves by interleaving them with
// a zero vector (`shuffle`, then `asU16x8`, little-endian), weighted with
// `mulWrapping` (no product exceeds 255 * 16, so nothing wraps) and summed.
// Lengths 0, 1, 15, 16, 17, 31, 32 and 33, a 100-byte tail and 4000 bytes of
// 0xff (where both sums wrap the modulus many times) are checked, and so is
// the published value of "Wikipedia".
import { asU16x8, loadU8x16, mulWrapping, shuffle, splatU8x16, sum, u16x8 } from "nish:simd";

/** The Adler-32 modulus: the largest prime below 2^16. */
const MOD: i32 = 65521;

/** Adler-32 of `xs`, one byte at a time. */
const adlerScalar = (xs: readonly u8[]): u32 => {
  let a: i32 = 1;
  let b: i32 = 0;
  for (let i: i32 = 0; i < toI32(xs.length); i += 1) {
    a = (a + toI32(xs[i])) % MOD;
    b = (b + a) % MOD;
  }
  return (toU32(b) << toU32(16)) | toU32(a);
};

/** `adlerScalar`, sixteen bytes a step, then the last fewer-than-sixteen bytes one at a time. */
const adlerLanes = (xs: readonly u8[]): u32 => {
  const n: i32 = toI32(xs.length);
  const zero = splatU8x16(0);
  const weightsLow = u16x8(16, 15, 14, 13, 12, 11, 10, 9);
  const weightsHigh = u16x8(8, 7, 6, 5, 4, 3, 2, 1);
  let a: i32 = 1;
  let b: i32 = 0;
  let i: i32 = 0;
  while (i + 16 <= n) {
    const v = loadU8x16(xs, i);
    const low = asU16x8(shuffle(v, zero, 0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23));
    const high = asU16x8(shuffle(v, zero, 8, 24, 9, 25, 10, 26, 11, 27, 12, 28, 13, 29, 14, 30, 15, 31));
    const weighted: i32 = sum(mulWrapping(low, weightsLow)) + sum(mulWrapping(high, weightsHigh));
    b = (b + 16 * a + weighted) % MOD;
    a = (a + sum(v)) % MOD;
    i += 16;
  }
  for (; i < n; i += 1) {
    a = (a + toI32(xs[i])) % MOD;
    b = (b + a) % MOD;
  }
  return (toU32(b) << toU32(16)) | toU32(a);
};

/** `n` bytes from a small linear congruential generator seeded by `seed` (every product fits in a double, so the program prints the same under `runtime/nish.mjs`). */
const noise = (n: i32, seed: i32): u8[] => {
  const out: u8[] = [];
  let x: i32 = seed;
  for (let i: i32 = 0; i < n; i += 1) {
    x = (x * 75 + 74) % 65537;
    out.push(toU8(x & 255));
  }
  return out;
};

/** The bytes of an ASCII `text`. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < text.length; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `n` bytes of 0xff. */
const ones = (n: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(255));
  }
  return out;
};

/** A u32 as eight lower-case hex digits. */
const hex8 = (x: u32): string => {
  const out = new Array<u8>(8);
  for (let k: i32 = 0; k < 8; k += 1) {
    const nibble: i32 = toI32((x >>> toU32(28 - 4 * k)) & toU32(15));
    out[k] = toU8(nibble < 10 ? 48 + nibble : 87 + nibble);
  }
  return String.fromBytes(out, 0, 8);
};

export const main = (): number => {
  const lengths: readonly i32[] = [0, 1, 15, 16, 17, 31, 32, 33, 100];
  let mismatches: i32 = 0;
  for (const n of lengths) {
    const xs = noise(n, n + 1);
    const scalar = adlerScalar(xs);
    const lanes = adlerLanes(xs);
    if (scalar !== lanes) {
      mismatches += 1;
    }
    console.log(`length ${n}: scalar ${hex8(scalar)}, lanes ${hex8(lanes)}`);
  }
  const saturated = ones(4000);
  const scalarOnes = adlerScalar(saturated);
  const lanesOnes = adlerLanes(saturated);
  if (scalarOnes !== lanesOnes) {
    mismatches += 1;
  }
  console.log(`4000 bytes of 0xff: scalar ${hex8(scalarOnes)}, lanes ${hex8(lanesOnes)}`);
  const wiki = ascii("Wikipedia");
  const scalarWiki = adlerScalar(wiki);
  const lanesWiki = adlerLanes(wiki);
  // Both must also give the checksum Wikipedia's Adler-32 article publishes.
  if (scalarWiki !== lanesWiki || hex8(scalarWiki) !== "11e60398") {
    mismatches += 1;
  }
  console.log(`Wikipedia: scalar ${hex8(scalarWiki)}, lanes ${hex8(lanesWiki)} (published 11e60398)`);
  // "Wikipedia" is nine bytes, so it never reaches a block: repeated to 36 it does.
  const wiki4 = ascii("WikipediaWikipediaWikipediaWikipedia");
  if (adlerScalar(wiki4) !== adlerLanes(wiki4)) {
    mismatches += 1;
  }
  console.log(`Wikipedia x4: scalar ${hex8(adlerScalar(wiki4))}, lanes ${hex8(adlerLanes(wiki4))}`);
  console.log(`mismatches: ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
};
