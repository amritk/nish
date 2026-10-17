// A function that runs a map and answers a scalar gives its frame back when it
// returns, as its sequential twin does: the map's result array, and the blocks
// a string map adopts from its workers, are freed with the frame. Before that,
// the region's entry counted as keeping the array it was handed, and a string
// map's chunk loop stored into an array escape analysis lost, so every caller
// kept every result: without the third loop, which main refused to compile,
// this peaked at 281 MB on 1, 4 and 8 threads, and now peaks at 18 to 20 MB.
//
// The third loop runs a map in main's own frame, which never returns between
// rounds, so only `using a = arena()` around it gives each round back. The
// block used to refuse a map; it now refuses only one whose body answers
// arrays (`tests/cases/reject_using_arena_map_arrays`).
import { parallelFrom, parallelMap } from "nish/threads";

const scaled = (xs: i32[], seed: i32, at: i32): i32 => {
  const k: i32 = (seed % 5) + 3;
  const ys = parallelMap(xs, (x) => x * k);
  let s: i32 = 0;
  if (at >= 0 && at < ys.length) {
    s = ys[at];
  }
  return s;
};

const worded = (xs: i32[], seed: i32): i32 => {
  const ws = parallelMap(xs, (x) => `w${x + seed}`);
  let t: i32 = 0;
  for (const w of ws) {
    t = (t + w.length) % 1000003;
  }
  return t;
};

export const main = (): i32 => {
  const n: i32 = 1 << 21;
  const xs = parallelFrom(n, (i) => ((i % 8191) * 7919) % 65536);
  let check: i32 = 0;
  for (let r: i32 = 0; r < 24; r++) {
    const at: i32 = (r * 7919) % n;
    check = (check * 31 + scaled(xs, r, at)) % 1000003;
  }
  const small = parallelFrom(1 << 17, (i) => (i * 31) % 100000);
  for (let r: i32 = 0; r < 24; r++) {
    check = (check * 31 + worded(small, r)) % 1000003;
  }
  for (let r: i32 = 0; r < 24; r++) {
    using a = arena();
    const m: i32 = r;
    const ys = parallelMap(xs, (x) => x * m + 1);
    check = (check * 31 + ys[r * 7919] + ys.length) % 1000003;
  }
  console.log(`${check}`);
  return 0;
};
