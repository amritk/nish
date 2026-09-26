// WP32 comparison (c): the global `Map` presized with `reserve(m, n)` from
// `nish/map` against the same map left to grow (docs/wp32-map.md §10, `reserve`
// in §9.2).
//
// The workload is §2's `insert`: four fresh tables of the first `n` keys, each
// mapped to its index. `grow` starts every table at its eight buckets and
// doubles it at the load bound; `reserve` sizes the buckets for `n` entries
// before the first insert, so it never rebuilds. Only that call differs. Both
// end at the same bucket count, so presizing saves the rebuilds and the bucket
// arrays they abandon to the arena, and costs nothing in the final table.
//
// Its checksum is the `insert str` and `insert int` lines every `map_proto_*`
// program and bench/map_node.mjs print, so the unordered prototype's row is the
// same work. The two variants must agree, which this program checks, and the
// lines must equal bench/map_presize.mjs's, which runs both on Node's `Map`,
// where `reserve` is `nish/map`'s own body and does nothing.
//
//   map_presize [time] [grow | reserve]
//
// `time` prints each variant's elapsed nanoseconds to stderr as
// `time insert <kind> <variant> <ns>`. Naming a variant runs it alone, so that
// the harness times each in a process of its own, and a process's peak
// resident memory is that variant's.
import { reserve } from "nish/map";

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

/** A fresh table holding the first `n` keys, each mapped to its index; presized first when `presized`. */
const fillStr = (keys: string[], n: i32, presized: boolean): Map<string, i32> => {
  const m = new Map<string, i32>();
  if (presized) {
    reserve(m, n);
  }
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const fillInt = (keys: i32[], n: i32, presized: boolean): Map<i32, i32> => {
  const m = new Map<i32, i32>();
  if (presized) {
    reserve(m, n);
  }
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const sumStr = (m: Map<string, i32>): u32 => {
  let total: u32 = 0;
  for (const v of m.values()) {
    total = total + toU32(v);
  }
  return total;
};

const sumInt = (m: Map<i32, i32>): u32 => {
  let total: u32 = 0;
  for (const v of m.values()) {
    total = total + toU32(v);
  }
  return total;
};

const insertStr = (keys: string[], n: i32, presized: boolean, timing: boolean): string => {
  const t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillStr(keys, n, presized).size;
  }
  const m = fillStr(keys, n, presized);
  const line = `insert str ${built + m.size} ${sumStr(m)}`;
  lap(timing, presized ? "insert str reserve" : "insert str grow", t);
  return line;
};

const insertInt = (keys: i32[], n: i32, presized: boolean, timing: boolean): string => {
  const t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillInt(keys, n, presized).size;
  }
  const m = fillInt(keys, n, presized);
  const line = `insert int ${built + m.size} ${sumInt(m)}`;
  lap(timing, presized ? "insert int reserve" : "insert int grow", t);
  return line;
};

/** Print the checksum of whichever variants ran (`""` for one that did not), requiring both to be the same. */
const settle = (grown: string, presized: string): void => {
  if (grown !== "" && presized !== "" && grown !== presized) {
    panic(`grown and presized maps disagree: ${grown} against ${presized}`);
  }
  console.log(grown !== "" ? grown : presized);
};

export const main = (): i32 => {
  // The key count; a power of two, as in the other map programs.
  const n: i32 = 65536; // bench:n
  const timing = process.argv.length > 1 && process.argv[1] === "time";
  const at = timing ? 2 : 1;
  const only = process.argv.length > at ? process.argv[at] : "";
  const grow = only === "" || only === "grow";
  const presize = only === "" || only === "reserve";
  const ints = intKeys(n);
  const strs = strKeys(ints);
  settle(grow ? insertStr(strs, n, false, timing) : "", presize ? insertStr(strs, n, true, timing) : "");
  settle(grow ? insertInt(ints, n, false, timing) : "", presize ? insertInt(ints, n, true, timing) : "");
  return 0;
};
