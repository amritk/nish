// Three byte scans run two ways over the same buffers: a scalar loop, and
// sixteen lanes at a time through `nish:simd` with a scalar tail for the last
// fewer-than-sixteen bytes. The scans are the first index of a byte (`eq` and
// `bitmask`), the count of a byte (`select` and `sum`) and the length of a run
// of one byte (`ne` and `bitmask`). Every length below 16, at 16 and 32 and
// either side of them, and 100 is tried with the byte at every position and
// absent, so the lane-wise answer meets the scalar one in the blocks, at the
// block boundary and in the tail. The program prints how many answers agreed
// and names the first that did not.
import { bitmask, eq, loadU8x16, ne, select, splatU8x16, sum } from "nish:simd";

/** The lengths tried: empty, one byte, either side of one and two blocks, and a long tail. */
const LENGTHS: readonly i32[] = [0, 1, 2, 7, 15, 16, 17, 31, 32, 33, 47, 100];

/** The index of the lowest set bit of a non-zero `bits`. */
const lowestBit = (bits: i32): i32 => 31 - Math.clz32(bits & (0 - bits));

/** The first index of `byte` in `xs`, or -1, one byte at a time. */
const indexOfScalar = (xs: u8[], byte: u8): i32 => {
  for (let i: i32 = 0; i < toI32(xs.length); i += 1) {
    if (xs[i] === byte) {
      return i;
    }
  }
  return -1;
};

/** `indexOfScalar`, sixteen bytes a compare. */
const indexOfLanes = (xs: u8[], byte: u8): i32 => {
  const n: i32 = toI32(xs.length);
  const needle = splatU8x16(byte);
  let i: i32 = 0;
  while (i + 16 <= n) {
    const bits: i32 = bitmask(eq(loadU8x16(xs, i), needle));
    if (bits !== 0) {
      return i + lowestBit(bits);
    }
    i += 16;
  }
  for (; i < n; i += 1) {
    if (xs[i] === byte) {
      return i;
    }
  }
  return -1;
};

/** How many bytes of `xs` are `byte`, one byte at a time. */
const countScalar = (xs: u8[], byte: u8): i32 => {
  let count: i32 = 0;
  for (let i: i32 = 0; i < toI32(xs.length); i += 1) {
    if (xs[i] === byte) {
      count += 1;
    }
  }
  return count;
};

/** `countScalar`, a block's matches summed as sixteen lanes of 0 or 1. */
const countLanes = (xs: u8[], byte: u8): i32 => {
  const n: i32 = toI32(xs.length);
  const needle = splatU8x16(byte);
  const one = splatU8x16(1);
  const zero = splatU8x16(0);
  let count: i32 = 0;
  let i: i32 = 0;
  while (i + 16 <= n) {
    count += sum(select(eq(loadU8x16(xs, i), needle), one, zero));
    i += 16;
  }
  for (; i < n; i += 1) {
    if (xs[i] === byte) {
      count += 1;
    }
  }
  return count;
};

/** How many bytes of `xs` from the start are `byte`, one byte at a time. */
const runScalar = (xs: u8[], byte: u8): i32 => {
  let i: i32 = 0;
  while (i < toI32(xs.length) && xs[i] === byte) {
    i += 1;
  }
  return i;
};

/** `runScalar`, stopping on the first block with a lane that differs. */
const runLanes = (xs: u8[], byte: u8): i32 => {
  const n: i32 = toI32(xs.length);
  const needle = splatU8x16(byte);
  let i: i32 = 0;
  while (i + 16 <= n) {
    const bits: i32 = bitmask(ne(loadU8x16(xs, i), needle));
    if (bits !== 0) {
      return i + lowestBit(bits);
    }
    i += 16;
  }
  while (i < n && xs[i] === byte) {
    i += 1;
  }
  return i;
};

/** `n` bytes from the letters `a` to `h`, from a small linear congruential generator seeded by `seed` (every product fits in a double, so the program prints the same under `runtime/nish.mjs`). */
const letters = (n: i32, seed: i32): u8[] => {
  const out: u8[] = [];
  let x: i32 = seed;
  for (let i: i32 = 0; i < n; i += 1) {
    x = (x * 75 + 74) % 65537;
    out.push(toU8(97 + (x & 7)));
  }
  return out;
};

/** `n` copies of `a`, with a `b` at `at` when `at` is inside them. */
const runOfA = (n: i32, at: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(i === at ? 98 : 97));
  }
  return out;
};

export const main = (): number => {
  const z: u8 = toU8(122);
  const a: u8 = toU8(97);
  let tried: i32 = 0;
  let agreed: i32 = 0;
  let first: string = "";
  for (const n of LENGTHS) {
    // `at === -1` leaves the buffer without the byte it is searched for.
    for (let at: i32 = -1; at < n; at += 1) {
      const xs = letters(n, n * 7 + 3);
      if (at >= 0) {
        xs[at] = z;
      }
      const runs = runOfA(n, at);
      const pairs: i32[] = [
        indexOfScalar(xs, z), indexOfLanes(xs, z),
        countScalar(xs, a), countLanes(xs, a),
        runScalar(runs, a), runLanes(runs, a),
      ];
      for (let k: i32 = 0; k + 1 < toI32(pairs.length); k += 2) {
        tried += 1;
        if (pairs[k] === pairs[k + 1]) {
          agreed += 1;
        } else if (first === "") {
          first = `scan ${k / 2} at length ${n}, byte ${at}: scalar ${pairs[k]}, lanes ${pairs[k + 1]}`;
        }
      }
    }
  }
  console.log(`agreed: ${agreed} of ${tried}`);
  if (first !== "") {
    console.log(`first difference: ${first}`);
  }
  const long = letters(33, 9);
  long[32] = z;
  console.log(`length 33, z at 32: index ${indexOfLanes(long, z)}, count of a ${countLanes(long, a)}`);
  console.log(`run of 31 before a b at 31: ${runLanes(runOfA(40, 31), a)}`);
  return agreed === tried ? 0 : 1;
};
