// `nish/random`: a generator seeded from an `i32` answers the same numbers
// natively and under Node, because its step wraps where `nish:unsafe` says
// and nowhere else, and seeds 0, 1 and 2 answer unrelated sequences. A task and a data-parallel body each make one of their own, which
// is memory only they reach, so stepping it writes nothing shared; the tasks
// add their counts under a lock, which commutes, and the body's answers land
// at their own indices, so every line prints the same both ways.
import { Rng } from "nish/random";
import { Mutex, parallelFrom, scope } from "nish/threads";

class Tally {
  hits: i32 = 0;
}

/** How many of `n` points in the unit square, drawn from `seed`, fall inside the quarter circle. */
const darts = (seed: i32, n: i32): i32 => {
  const r = new Rng(seed);
  let hits: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    const x = r.nextF64();
    const y = r.nextF64();
    if (x * x + y * y < 1.0) {
      hits = hits + 1;
    }
  }
  return hits;
};

const throwInto = (tally: Mutex<Tally>, seed: i32, n: i32): void => {
  const hits = darts(seed, n);
  using g = tally.lock();
  g.value.hits = g.value.hits + hits;
};

export const main = (): i32 => {
  const r = new Rng(42);
  console.log(`${r.nextI32()} ${r.nextI32()} ${r.nextI32()} ${r.nextF64()}`);
  const z = new Rng(0);
  const a = new Rng(-7);
  const b = new Rng(-7);
  console.log(`${z.nextI32()} ${a.nextI32() === b.nextI32()} ${(r.nextI32() >>> 1) % 6}`);
  const tally = new Mutex<Tally>(new Tally());
  const n: i32 = 2000;
  {
    using s = scope();
    s.spawn(() => throwInto(tally, 1, n));
    s.spawn(() => throwInto(tally, 2, n));
    s.spawn(() => throwInto(tally, 3, n));
    s.spawn(() => throwInto(tally, 4, n));
  }
  const draws = parallelFrom(6, (i: i32): i32 => {
    const own = new Rng(i + 1);
    return own.nextI32() >>> 8;
  });
  using g = tally.lock();
  console.log(`${g.value.hits} of ${4 * n}`);
  console.log(`${draws[0]} ${draws[1]} ${draws[5]}`);
  return 0;
};
