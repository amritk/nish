// WP32 (docs/wp32-map.md §5.2; docs/security/json.md, JSON-15): a `Map<i32, V>` hashes its keys under the process's
// random integer key, so keys chosen to collide under an unkeyed hash land in buckets of their own. Up to 0.28 an
// integer key was hashed with murmur3's `fmix32` alone, which anyone can invert: `flood(k)` is the key whose `fmix32`
// is `k * 0x10001`, whose two halves are equal, so `h ^ h >>> 16` is zero below bit 16 and every key below has home
// bucket 0. Under 0.28 each insert walked every key before it, a probe chain 8,192 long by the end; built by the 0.28
// compiler this prints `false` on the first line, and the flood ran about 210 to 220 times slower than the ordinary keys.
//
// A golden cannot hold a time, so the program races the flood against as many ordinary keys and prints whether it came
// within 8 times, taking the fastest of five tries of each so that a descheduled try cannot fail it.
import { wrappingMul } from "nish:unsafe";

const N: i32 = 8192;

/** The inverse of murmur3's `fmix32`, whose constants are public domain: `fmix32(unmix(h)) === h`. */
const unmix = (h: i32): i32 => {
  let x = h ^ (h >>> 16);
  x = wrappingMul(x, 2127672349);
  x = x ^ (x >>> 13) ^ (x >>> 26);
  x = wrappingMul(x, -1513385405);
  return x ^ (x >>> 16);
};

/** The `k`th key of the flood: `fmix32` of it is `k * 0x10001`. */
const flood = (k: i32): i32 => unmix(wrappingMul(k, 65537));

/** The `k`th ordinary key. */
const plain = (k: i32): i32 => wrappingMul(k, 7919);

/** Nanoseconds to insert `N` keys and find each, the fastest of five tries; adds every value found to `sums[0]`. */
const race = (adversarial: boolean, sums: i32[]): i64 => {
  let best: i64 = toI64(-1);
  for (let round: i32 = 0; round < 5; round++) {
    const m = new Map<i32, i32>();
    const started: i64 = monotonicNanos();
    for (let k: i32 = 0; k < N; k++) {
      m.set(adversarial ? flood(k) : plain(k), k);
    }
    let found: i32 = 0;
    for (let k: i32 = 0; k < N; k++) {
      found = found + (m.get(adversarial ? flood(k) : plain(k)) ?? -N);
    }
    const ns: i64 = monotonicNanos() - started;
    sums[0] = sums[0] + found;
    if (best < toI64(0) || ns < best) {
      best = ns;
    }
  }
  return best;
};

export const main = (): i32 => {
  const sums: i32[] = [0];
  const ordinary = race(false, sums);
  const flooded = race(true, sums);
  const distinct = new Set<i32>();
  for (let k: i32 = 0; k < N; k++) {
    distinct.add(flood(k));
  }
  console.log(`${flooded < toI64(8) * ordinary + toI64(1000000)}`);
  console.log(`${distinct.size} ${sums[0]} ${unmix(65537)} ${flood(1)} ${flood(2)}`);
  return 0;
};
