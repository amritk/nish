// `nish/random`: a generator seeded from an `i32` answers the same numbers
// natively and under Node, because its step wraps where `nish:unsafe` says
// and nowhere else, and seeds 0, 1 and 2 answer unrelated sequences. A task and a data-parallel body each make one of their own, which
// is memory only they reach, so stepping it writes nothing shared; the tasks
// add their counts under a lock, which commutes, and the body's answers land
// at their own indices, so every line prints the same both ways.
//
// `nextInt` prints a pinned run of dice, a one-value range that steps once,
// the whole `i32` range answering what a twin's `nextI32` does, and ranges
// whose span is near 2^31, where the refused share is largest, staying in
// bounds. Its counts are even: six faces over 60,000 draws, and the thirds of a
// span of 3 * 2^30, where a plain remainder lands in the first third twice as
// often as in either other.
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

/** Whether every one of `n` answers of `r.nextInt(lo, hi)` is in [lo, hi]. */
const inBounds = (r: Rng, lo: i32, hi: i32, n: i32): boolean => {
  let ok = true;
  for (let i: i32 = 0; i < n; i++) {
    const x = r.nextInt(lo, hi);
    if (x < lo || x > hi) {
      ok = false;
    }
  }
  return ok;
};

/** Whether every count in `counts` is within `slack` of `want`. */
const even = (counts: i32[], want: i32, slack: i32): boolean => {
  let ok = true;
  for (const c of counts) {
    if (c < want - slack || c > want + slack) {
      ok = false;
    }
  }
  return ok;
};

const ranges = (): void => {
  const d = new Rng(42);
  const dice: string[] = [];
  for (let i: i32 = 0; i < 20; i++) {
    dice.push(`${d.nextInt(1, 6)}`);
  }
  const one = new Rng(9);
  const twin = new Rng(9);
  const five = one.nextInt(5, 5);
  twin.nextI32();
  console.log(`${dice.join("")} ${five} ${one.nextI32() === twin.nextI32()}`);

  const whole = new Rng(3);
  const whole2 = new Rng(3);
  let same = true;
  for (let i: i32 = 0; i < 1000; i++) {
    if (whole.nextInt(-2147483648, 2147483647) !== whole2.nextI32()) {
      same = false;
    }
  }
  const r = new Rng(5);
  console.log(
    `${same} ${inBounds(r, -3, 3, 1000)} ${inBounds(r, 0, 2147483647, 1000)} ${inBounds(r, -2147483648, 0, 1000)} ${inBounds(r, 7, 8, 1000)}`
  );

  const faces = new Rng(11);
  const counts: i32[] = [0, 0, 0, 0, 0, 0];
  for (let i: i32 = 0; i < 60000; i++) {
    const k = faces.nextInt(0, 5);
    if (k >= 0 && k < counts.length) {
      counts[k] = counts[k] + 1;
    }
  }
  console.log(`${counts[0]} ${counts[1]} ${counts[2]} ${counts[3]} ${counts[4]} ${counts[5]} ${even(counts, 10000, 400)}`);

  const wide = new Rng(13);
  const thirds: i32[] = [0, 0, 0];
  for (let i: i32 = 0; i < 30000; i++) {
    const x = wide.nextInt(-2147483648, 1073741823);
    if (x < -1073741824) {
      thirds[0] = thirds[0] + 1;
    } else if (x < 0) {
      thirds[1] = thirds[1] + 1;
    } else {
      thirds[2] = thirds[2] + 1;
    }
  }
  console.log(`${thirds[0]} ${thirds[1]} ${thirds[2]} ${even(thirds, 10000, 400)}`);
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
  ranges();
  return 0;
};
