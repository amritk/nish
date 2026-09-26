// WP32 comparison (c) on Node's global `Map`: the twin of bench/map_presize.ts
// (docs/wp32-map.md §10). Node's `Map` cannot be presized, so `reserve` here is
// `nish/map`'s own body (std/map.ts), which does nothing, and the two variants
// run the same code: the Node column says what growing costs there, and that
// the call is free. It prints the same two lines as the Nish program.
//
//   node bench/map_presize.mjs [time] [grow | reserve]
//
// `time` prints each variant's elapsed nanoseconds to stderr as
// `time insert <kind> <variant> <ns>`, and naming a variant runs it alone, as
// the Nish program does. In one process the variant that runs second would
// find the JIT warm.

const timing = process.argv[2] === "time";
const only = process.argv[timing ? 3 : 2] ?? "";

/** `nish/map`'s `reserve` as Node runs it. */
const reserve = (_m, _n) => {};

const intKeys = (n) => {
  const keys = [];
  for (let i = 0; i < 2 * n; i++) keys.push(Math.imul(i, 2654435761 | 0));
  return keys;
};

const fill = (keys, n, presized) => {
  const m = new Map();
  if (presized) reserve(m, n);
  for (let i = 0; i < n; i++) m.set(keys[i], i);
  return m;
};

const sum = (m) => {
  let total = 0;
  for (const v of m.values()) total = (total + (v >>> 0)) >>> 0;
  return total;
};

const insert = (keys, n, kind, presized) => {
  const t = process.hrtime.bigint();
  let built = 0;
  for (let round = 0; round < 3; round++) built += fill(keys, n, presized).size;
  const m = fill(keys, n, presized);
  const line = `insert ${kind} ${built + m.size} ${sum(m)}`;
  if (timing)
    process.stderr.write(
      `time insert ${kind} ${presized ? "reserve" : "grow"} ${process.hrtime.bigint() - t}\n`
    );
  return line;
};

/** Print the checksum of whichever variants ran (`""` for one that did not), requiring both to be the same. */
const settle = (grown, presized) => {
  if (grown !== "" && presized !== "" && grown !== presized) {
    throw new Error(`grown and presized maps disagree: ${grown} against ${presized}`);
  }
  console.log(grown !== "" ? grown : presized);
};
const grow = only === "" || only === "grow";
const presize = only === "" || only === "reserve";

const n = 65536; // bench:n
const ints = intKeys(n);
const strs = ints.map((k) => `k${k}`);
settle(grow ? insert(strs, n, "str", false) : "", presize ? insert(strs, n, "str", true) : "");
settle(grow ? insert(ints, n, "int", false) : "", presize ? insert(ints, n, "int", true) : "");
