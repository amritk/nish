// WP32 comparison (b): the global `Map` counting words with one probe per word
// against the same count asked twice (docs/wp32-map.md §10, fusion in §9.1).
//
// `fused` spells the count `counts.set(w, (counts.get(w) ?? 0) + 1)`, the
// update pattern the compiler folds into one probe. `double` reads the count
// into a `const` first and sets it in the next statement:
//
//   const c = counts.get(w);
//   counts.set(w, (c ?? 0) + 1);
//
// It does the same work, calls nothing and allocates nothing, but the `get` is
// not inside the `set`'s value, so §9.1's rules leave it unfused: a `get` and a
// `set` that probe once each. Only that differs between the two.
//
// The workload is §2's `count`, drawn from the same LCG at the same point, so
// its checksum is the `count str` and `count int` lines every `map_proto_*`
// program and bench/map_node.mjs print, and the unordered prototype's row is
// the same work. The two variants must agree, which this program checks, and
// the lines must equal bench/map_wordcount.mjs's, which runs both spellings on
// Node's `Map`.
//
//   map_wordcount [time] [fused | double]
//
// `time` prints each variant's elapsed nanoseconds to stderr as
// `time count <kind> <variant> <ns>`. Naming a variant runs it alone, so that
// the harness times each in a process of its own and neither runs on the
// memory the other left.

/** A 32-bit LCG (Numerical Recipes); the top 24 bits are the draw. */
class Rng {
  state: u32 = 12345;

  next(): i32 {
    this.state = this.state * 1664525 + 1013904223;
    return toI32(this.state >>> 8);
  }
}

/**
 * The generator as §2's `count` workload finds it: after the `8n` draws of
 * `hit` and the `8n` of `miss`, which run before it there.
 */
const countRng = (n: i32): Rng => {
  const rng = new Rng();
  for (let j = 0; j < 16 * n; j++) {
    rng.next();
  }
  return rng;
};

/** §2's `2n` distinct integer keys: `i * 2654435761` as an `i32`. */
const intKeys = (n: i32): i32[] => {
  const keys: i32[] = [];
  for (let i = 0; i < 2 * n; i++) {
    keys.push(toI32(toU32(i) * 2654435761));
  }
  return keys;
};

const strKeys = (ints: i32[]): string[] => {
  const keys: string[] = [];
  for (const k of ints) {
    keys.push(`k${k}`);
  }
  return keys;
};

/** The clock, read only when timing, so that an untimed run's instruction count does not depend on the vDSO. */
const clock = (timing: boolean): i64 => (timing ? monotonicNanos() : 0);

const lap = (timing: boolean, label: string, started: i64): void => {
  if (timing) {
    writeError(`time ${label} ${monotonicNanos() - started}\n`);
  }
};

/** `8n` words from a vocabulary of `n / 4`, skewed to low indices, each counted with one probe. */
const countStrFused = (keys: string[], n: i32, timing: boolean): string => {
  const rng = countRng(n);
  const t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<string, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lap(timing, "count str fused", t);
  return `count str ${counts.size} ${weighted}`;
};

/** The same count, asked with a `get` and then a `set`: two probes a word. */
const countStrDouble = (keys: string[], n: i32, timing: boolean): string => {
  const rng = countRng(n);
  const t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<string, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      const c = counts.get(w);
      counts.set(w, (c ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lap(timing, "count str double", t);
  return `count str ${counts.size} ${weighted}`;
};

const countIntFused = (keys: i32[], n: i32, timing: boolean): string => {
  const rng = countRng(n);
  const t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<i32, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lap(timing, "count int fused", t);
  return `count int ${counts.size} ${weighted}`;
};

const countIntDouble = (keys: i32[], n: i32, timing: boolean): string => {
  const rng = countRng(n);
  const t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<i32, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      const c = counts.get(w);
      counts.set(w, (c ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lap(timing, "count int double", t);
  return `count int ${counts.size} ${weighted}`;
};

/** Print the checksum of whichever variants ran (`""` for one that did not), requiring both to be the same. */
const settle = (fused: string, double: string): void => {
  if (fused !== "" && double !== "" && fused !== double) {
    panic(`fused and double lookup disagree: ${fused} against ${double}`);
  }
  console.log(fused !== "" ? fused : double);
};

export const main = (): i32 => {
  // The key count; a power of two, because the workload draws an index by masking.
  const n: i32 = 65536; // bench:n
  const timing = process.argv.length > 1 && process.argv[1] === "time";
  const at = timing ? 2 : 1;
  const only = process.argv.length > at ? process.argv[at] : "";
  const fused = only === "" || only === "fused";
  const double = only === "" || only === "double";
  const ints = intKeys(n);
  const strs = strKeys(ints);
  settle(fused ? countStrFused(strs, n, timing) : "", double ? countStrDouble(strs, n, timing) : "");
  settle(fused ? countIntFused(ints, n, timing) : "", double ? countIntDouble(ints, n, timing) : "");
  return 0;
};
