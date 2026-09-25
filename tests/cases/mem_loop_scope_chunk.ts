// A pass that allocates more than an arena chunk holds (64 KB) pushes a chunk
// of its own, so the arena's `buf` has moved by the end of the pass and
// rewinding `off` is not the whole release: the scope hands the mark to
// `nish_arena_release`, which frees the chunk. tests/run.js runs this at 20
// and at 2000 rounds and holds the peak resident set flat; without the
// per-pass scope the second run keeps 2000 chunks, about 160 MB.
class Box {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

const big = (n: i32): i32[] => {
  const xs = new Array<i32>(20000 + (n % 3));
  for (let i = 0; i < xs.length; i++) {
    xs[i] = i + n;
  }
  return xs;
};

const summarise = (rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    const xs = big(i);
    total = (total + xs[xs.length - 1]) & 1048575;
  }
  return new Box(total);
};

export const main = (): void => {
  const rounds = process.argv.length > 1 ? parseInt(process.argv[1]) : 20;
  console.log(`${summarise(rounds).n}`);
};
