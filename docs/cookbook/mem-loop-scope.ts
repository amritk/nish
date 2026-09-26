// `summarise` returns a pointer, so it gets no scope of its own, and each
// list `build` returns is garbage once its length is read. Nothing the pass
// allocates reaches `total`, older memory, or the `return`, so every pass is
// bracketed: the mark is the arena's `buf` and `off`, and the release rewinds
// `off` unless the pass pushed a chunk.
class Box {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

const build = (n: i32): i32[] => [n, n + 1, n + 2];

export const summarise = (rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total = total + build(i).length;
  }
  return new Box(total);
};
