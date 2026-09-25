// WP32: the `map_proto_*` workloads on Node's global `Map`, the reference the
// four layout prototypes are measured against (docs/wp32-map.md §2). It draws
// the same keys from the same LCG in the same order and prints the same
// checksums, so `bench/run.mjs --only maps` can require all five to agree.
// Every 32-bit step is spelled the way the prototypes compute it: `Math.imul`
// for a wrapping multiply, `>>> 0` for a `u32`, `| 0` for an `i32`.
//
//   node bench/map_node.mjs [time]
//
// `time` prints each workload's elapsed nanoseconds to stderr, as the
// prototypes do.

const timing = process.argv[2] === "time";

/** The prototypes' `Rng`: a 32-bit LCG whose top 24 bits are the draw. */
const makeRng = () => {
  let state = 12345;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 8;
  };
};

const intKeys = (n) => {
  const keys = [];
  for (let i = 0; i < 2 * n; i++) keys.push(Math.imul(i, 2654435761 | 0));
  return keys;
};

const report = (name, started, checksum) => {
  const elapsed = process.hrtime.bigint() - started;
  console.log(`${name} ${checksum}`);
  if (timing) process.stderr.write(`time ${name} ${elapsed}\n`);
};

const sum = (m) => {
  let total = 0;
  for (const v of m.values()) total = (total + (v >>> 0)) >>> 0;
  return total;
};

const fill = (keys, n) => {
  const m = new Map();
  for (let i = 0; i < n; i++) m.set(keys[i], i);
  return m;
};

/** The five workloads over one key kind, exactly as `runStr` / `runInt` run them. */
const run = (keys, n, kind) => {
  const mask = n - 1;
  const next = makeRng();
  let t = process.hrtime.bigint();
  let built = 0;
  for (let round = 0; round < 3; round++) built += fill(keys, n).size;
  const m = fill(keys, n);
  report(`insert ${kind}`, t, `${built + m.size} ${sum(m)}`);

  t = process.hrtime.bigint();
  let hits = 0;
  for (let j = 0; j < 8 * n; j++) hits = (hits + ((m.get(keys[next() & mask]) ?? -1) >>> 0)) >>> 0;
  report(`hit ${kind}`, t, `${hits}`);

  t = process.hrtime.bigint();
  let misses = 0;
  for (let j = 0; j < 8 * n; j++) misses = (misses + ((m.get(keys[n + (next() & mask)]) ?? j & 7) >>> 0)) >>> 0;
  report(`miss ${kind}`, t, `${misses}`);

  t = process.hrtime.bigint();
  const vocab = n / 4;
  const counts = new Map();
  for (let j = 0; j < 8 * n; j++) {
    const key = keys[next() & next() & (vocab - 1)];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let weighted = 0;
  for (let i = 0; i < vocab; i++) weighted = (weighted + (Math.imul(counts.get(keys[i]) ?? 0, i) >>> 0)) >>> 0;
  report(`count ${kind}`, t, `${counts.size} ${weighted}`);

  t = process.hrtime.bigint();
  const window = n / 2;
  const pool = 2 * n - 1;
  const churn = new Map();
  for (let i = 0; i < 8 * n; i++) {
    churn.set(keys[i & pool], i);
    if (i >= window) churn.delete(keys[(i - window) & pool]);
  }
  report(`churn ${kind}`, t, `${churn.size} ${sum(churn)}`);
};

const n = 65536; // bench:n
const ints = intKeys(n);
run(
  ints.map((k) => `k${k}`),
  n,
  "str"
);
run(ints, n, "int");
