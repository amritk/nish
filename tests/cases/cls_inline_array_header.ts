// Negative: `--emit-header` writes a C struct for every class, so no class is
// laid out any other way than the header says. `Tally` is not exported and
// would qualify in a plain `-o` build (`cls_inline_array`); here it keeps
// `nish_array *counts`, and `tests/run.js` compiles a C host against the
// header that reads the field through it and checks the struct's size against
// the IR's allocation.
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
