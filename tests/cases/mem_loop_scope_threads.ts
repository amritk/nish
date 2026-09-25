// The per-pass scope under `--threads`: the arena is per thread, and so are
// the mark and the release, so the lowering is unchanged and the round trip
// is the one `mem_loop_scope` makes.
class Box {
  length: i32;

  constructor(length: i32) {
    this.length = length;
  }
}

const build = (n: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < 16 + (n % 3); i++) {
    xs.push(i);
  }
  return xs;
};

const summarise = (rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total = total + build(i).length;
  }
  return new Box(total);
};

export const main = (): void => {
  const before = Arena.used();
  const one = summarise(1).length;
  const small = Arena.used() - before;
  const many = summarise(2000).length;
  const large = Arena.used() - before - small;
  console.log(`${one} ${many} ${small === large ? "flat" : "grows"}`);
};
