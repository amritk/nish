// Hex encoding two ways over the same buffers: a scalar loop that writes two
// digits per byte, and a lane-wise loop that encodes sixteen bytes into
// thirty-two digits per step. A block's high nibbles come from `shr` (logical
// on u8 lanes) and its low nibbles from `and`; each nibble becomes a digit
// through `select` between `'0' + n` and `'a' - 10 + n`; and `shuffle`
// interleaves the high and low digits back into byte order. Every byte value
// is encoded, and lengths 0, 1, 15, 16, 17, 31, 32, 33 and 100 are compared.
import { and, addWrapping, loadU8x16, lt, select, shr, shuffle, splatU8x16, store } from "nish:simd";

/** A nibble's lower-case hex digit as a byte. */
const digit = (nibble: i32): u8 => toU8(nibble < 10 ? 48 + nibble : 87 + nibble);

/** `xs` as lower-case hex, one byte at a time. */
const hexScalar = (xs: readonly u8[]): string => {
  const n: i32 = toI32(xs.length);
  const out = new Array<u8>(2 * n);
  for (let i: i32 = 0; i < n; i += 1) {
    out[2 * i] = digit(toI32(xs[i]) >> 4);
    out[2 * i + 1] = digit(toI32(xs[i]) & 15);
  }
  return String.fromBytes(out, 0, 2 * n);
};

/** `hexScalar`, sixteen bytes a step, then the last fewer-than-sixteen bytes one at a time. */
const hexLanes = (xs: readonly u8[]): string => {
  const n: i32 = toI32(xs.length);
  const out = new Array<u8>(2 * n);
  const fifteen = splatU8x16(15);
  const ten = splatU8x16(10);
  const zeroDigit = splatU8x16(48);
  const letterDigit = splatU8x16(87);
  let i: i32 = 0;
  while (i + 16 <= n) {
    const v = loadU8x16(xs, i);
    const high = shr(v, 4);
    const low = and(v, fifteen);
    const highDigits = select(lt(high, ten), addWrapping(high, zeroDigit), addWrapping(high, letterDigit));
    const lowDigits = select(lt(low, ten), addWrapping(low, zeroDigit), addWrapping(low, letterDigit));
    store(shuffle(highDigits, lowDigits, 0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23), out, 2 * i);
    store(shuffle(highDigits, lowDigits, 8, 24, 9, 25, 10, 26, 11, 27, 12, 28, 13, 29, 14, 30, 15, 31), out, 2 * i + 16);
    i += 16;
  }
  for (; i < n; i += 1) {
    out[2 * i] = digit(toI32(xs[i]) >> 4);
    out[2 * i + 1] = digit(toI32(xs[i]) & 15);
  }
  return String.fromBytes(out, 0, 2 * n);
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

export const main = (): number => {
  let mismatches: i32 = 0;
  const lengths: readonly i32[] = [0, 1, 15, 16, 17, 31, 32, 33, 100];
  for (const n of lengths) {
    const xs = noise(n, n + 5);
    const scalar = hexScalar(xs);
    const lanes = hexLanes(xs);
    if (scalar !== lanes) {
      mismatches += 1;
      console.log(`length ${n} differs: scalar ${scalar}, lanes ${lanes}`);
    }
  }
  // Every byte value once, in order: sixteen whole blocks and no tail.
  const all = new Array<u8>(256);
  for (let i: i32 = 0; i < 256; i += 1) {
    all[i] = toU8(i);
  }
  const allScalar = hexScalar(all);
  if (allScalar !== hexLanes(all)) {
    mismatches += 1;
  }
  console.log(`every byte: ${allScalar.substring(0, 40)}...${allScalar.substring(472, 512)}`);
  // One block and a one-byte tail, printed so the expected output pins the text.
  const seventeen = noise(17, 22);
  const seventeenLanes = hexLanes(seventeen);
  if (seventeenLanes !== hexScalar(seventeen)) {
    mismatches += 1;
  }
  console.log(`17 bytes: ${seventeenLanes}`);
  console.log(`mismatches: ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
};
