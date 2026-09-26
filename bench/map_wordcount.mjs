// WP32 comparison (b) on Node's global `Map`: the twin of bench/map_wordcount.ts,
// which runs the same two spellings of §2's word count natively
// (docs/wp32-map.md §10). It draws the same keys from the same LCG at the same
// point and prints the same two lines. Every 32-bit step is spelled the way
// the Nish program computes it: `Math.imul` for a wrapping multiply, `>>> 0`
// for a `u32`.
//
//   node bench/map_wordcount.mjs [time] [fused | double]
//
// `time` prints each variant's elapsed nanoseconds to stderr as
// `time count <kind> <variant> <ns>`, and naming a variant runs it alone, as
// the Nish program does. Here that matters more: in one process the variant
// that runs second finds the JIT warm.

const timing = process.argv[2] === "time";
const only = process.argv[timing ? 3 : 2] ?? "";

/** The generator as §2's `count` workload finds it, after the `16n` draws of `hit` and `miss`. */
const countRng = (n) => {
  let state = 12345;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 8;
  };
  for (let j = 0; j < 16 * n; j++) next();
  return next;
};

const intKeys = (n) => {
  const keys = [];
  for (let i = 0; i < 2 * n; i++) keys.push(Math.imul(i, 2654435761 | 0));
  return keys;
};

/** The count, with `set(w, (get(w) ?? 0) + 1)` when `fused` and a `get` then a `set` otherwise. */
const count = (keys, n, kind, fused) => {
  const next = countRng(n);
  const t = process.hrtime.bigint();
  const vocab = n / 4;
  const counts = new Map();
  for (let j = 0; j < 8 * n; j++) {
    const w = keys[next() & next() & (vocab - 1)];
    if (fused) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    } else {
      const c = counts.get(w);
      counts.set(w, (c ?? 0) + 1);
    }
  }
  let weighted = 0;
  for (let i = 0; i < vocab; i++)
    weighted = (weighted + (Math.imul(counts.get(keys[i]) ?? 0, i) >>> 0)) >>> 0;
  if (timing)
    process.stderr.write(`time count ${kind} ${fused ? "fused" : "double"} ${process.hrtime.bigint() - t}\n`);
  return `count ${kind} ${counts.size} ${weighted}`;
};

/** Print the checksum of whichever variants ran (`""` for one that did not), requiring both to be the same. */
const settle = (fused, double) => {
  if (fused !== "" && double !== "" && fused !== double) {
    throw new Error(`fused and double lookup disagree: ${fused} against ${double}`);
  }
  console.log(fused !== "" ? fused : double);
};
const fused = only === "" || only === "fused";
const double = only === "" || only === "double";

const n = 65536; // bench:n
const ints = intKeys(n);
const strs = ints.map((k) => `k${k}`);
settle(fused ? count(strs, n, "str", true) : "", double ? count(strs, n, "str", false) : "");
settle(fused ? count(ints, n, "int", true) : "", double ? count(ints, n, "int", false) : "");
