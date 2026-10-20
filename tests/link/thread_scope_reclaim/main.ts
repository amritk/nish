// A frame that spawns into a `using s = scope()` gives back what it made when
// it returns, as one that only runs a map does: the scope joins at every exit
// of its block, inside the frame, so a task cannot read the frame's memory
// after it is released. Before that, every argument a spawn took counted as
// kept, so the frame kept its map's result, its own arrays and everything it
// called made. A loop pass that declares a scope gives back what it made once
// the scope joins, and a `using a = arena()` block may hand an array it made
// to a scope declared inside it, which joins before the block releases.
//
// Each loop is sized so that it alone would pass the 64 MB bound
// `tests/run.js` holds this program to if its frames kept what they made: 24
// int maps over 2^21 elements (8 MB each) spawned in a returning frame, 24
// maps spawned in loop passes that each declare their scope, and 24 fresh
// arrays of 2^21 spawned from a `using a = arena()` block in main.
import { parallelFrom, parallelMap, scope } from "nish/threads";

// Order-sensitive, so a task that read a released or reused array would print
// a different checksum.
const digest = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = (t * 31 + x) % 1000003;
  }
  return t;
};

const fill = (n: i32, seed: i32): i32[] => {
  const ys = new Array<i32>(n);
  for (let i: i32 = 0; i < ys.length; i++) {
    ys[i] = (i * 7 + seed) % 1009;
  }
  return ys;
};

// A map and a scope in one frame: the map's result is handed to a task.
const mappedThenSpawned = (xs: i32[], seed: i32): i32 => {
  const k: i32 = (seed % 5) + 3;
  const ys = parallelMap(xs, (x) => x * k);
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(digest, ys, out, 0);
    s.spawn(digest, xs, out, 1);
  }
  return (out[0] * 7 + out[1]) % 1000003;
};

export const main = (): i32 => {
  const n: i32 = 1 << 21;
  const xs = parallelFrom(n, (i) => ((i % 8191) * 7919) % 65536);
  let check: i32 = 0;
  for (let r: i32 = 0; r < 24; r++) {
    check = (check * 31 + mappedThenSpawned(xs, r)) % 1000003;
  }
  const passes = new Array<i32>(24);
  for (let r: i32 = 0; r < 24; r++) {
    const m: i32 = r;
    const ys = parallelMap(xs, (x) => x * m + 1);
    using s = scope();
    s.spawn(digest, ys, passes, r);
  }
  for (let r: i32 = 0; r < passes.length; r++) {
    check = (check * 31 + passes[r]) % 1000003;
  }
  const blocks = new Array<i32>(24);
  for (let r: i32 = 0; r < 24; r++) {
    using a = arena();
    const ys = fill(n, r + 100);
    {
      using s = scope();
      s.spawn(digest, ys, blocks, r);
    }
  }
  for (let r: i32 = 0; r < blocks.length; r++) {
    check = (check * 31 + blocks[r]) % 1000003;
  }
  console.log(`${check}`);
  return 0;
};
