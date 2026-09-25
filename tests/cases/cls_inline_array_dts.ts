// Negative: `--emit-dts` describes the program to a wasm host, so no class is
// laid out any other way than declared. `Tally` would qualify in a plain
// `-o` build and keeps the pointer layout here.
class Tally {
  counts: i32[];

  constructor() {
    this.counts = new Array<i32>(4);
  }
}

export const makeTally = (): Tally => {
  const t = new Tally();
  t.counts[2] = 5;
  return t;
};

export const tallyAt = (t: Tally, i: i32): i32 => t.counts[i];

export const test = (): number => {
  const t = makeTally();
  t.counts[1] = 3;
  return tallyAt(t, 1) + tallyAt(t, 2) + t.counts.length;
};
