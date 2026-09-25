// Negative: a module that declares a C function may hand that function an
// object, and the function was compiled against the declared layout, so no
// class is laid out any other way. `Tally` would qualify in a plain `-o`
// build; `abs` from libc is enough to keep the pointer layout here.
declare function abs(n: i32): i32;

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
  return abs(-tallyAt(t, 1)) + tallyAt(t, 2) + t.counts.length;
};
