// An array field the inline rule admits but cannot size is boxed: the object
// holds the array's `len` and `data` as `{ i64, i8* }` and nothing else, the
// elements are one block of their own, and no header is made. All three
// fresh right-hand sides reach it: a literal, `new Array<T>(n)` with a
// length known only at run time, and a call proven to return a fresh array
// whose length is its parameter. `.length` and indexing read the slice in
// the object directly. `Big` is boxed for the other reason: its length is a
// literal, but 65 `i32` slots would pass the 256 bytes an inline field may take.
class Big {
  slots: i32[];

  constructor() {
    this.slots = new Array<i32>(65);
  }
}

class Window {
  samples: i32[];
  count: i32 = 0;

  constructor(n: i32) {
    this.samples = new Array<i32>(n);
  }

  reset(): void {
    this.samples = [1, 3];
  }

  resize(n: i32): void {
    this.samples = ramp(n);
  }

  sum(): i32 {
    let s = 0;
    for (let i = 0; i < this.samples.length; i += 1) {
      s += this.samples[i];
    }
    return s;
  }
}

const ramp = (n: i32): i32[] => {
  const out = new Array<i32>(n);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = i;
  }
  return out;
};

export const main = (): number => {
  const w = new Window(3);
  w.samples[2] = 4;
  console.log(`${w.samples.length} ${w.sum()}`);
  w.reset();
  console.log(`${w.samples.length} ${w.sum()}`);
  w.resize(5);
  w.samples[0] += 10;
  console.log(`${w.samples.length} ${w.sum()}`);
  const b = new Big();
  b.slots[64] = 7;
  console.log(`${b.slots.length} ${b.slots[64]}`);
  return 0;
};
