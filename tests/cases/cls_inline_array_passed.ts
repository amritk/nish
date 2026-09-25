// Negative: the field is passed to a function, which writes through it. The
// write must reach the field -- it is read back afterwards -- so the array is
// a value and keeps the pointer layout.
class Counts {
  hits: i32[];

  constructor() {
    this.hits = [0, 0, 0];
  }
}

const hit = (xs: i32[], i: i32): void => {
  xs[i] += 1;
};

export const main = (): number => {
  const c = new Counts();
  hit(c.hits, 1);
  hit(c.hits, 1);
  console.log(`${c.hits[1]} ${c.hits.length}`);
  return 0;
};
