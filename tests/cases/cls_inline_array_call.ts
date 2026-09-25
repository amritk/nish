// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.
// The AWFY Queens shape: the field is assigned from a helper, and the helper
// is proven to return a fresh array whose length is its parameter -- a
// `const` local made by `new Array<T>(n)` that the helper only indexes and
// returns. `filled(8)` and `filled(16)` are then arrays of 8 and 16, the slots
// are sized for 16, and the assignment copies the helper's elements in.
class Rows {
  free: boolean[];

  constructor() {
    this.free = [];
  }

  fill(n: i32): void {
    if (n === 8) {
      this.free = filled(8);
    } else {
      this.free = filled(16);
    }
  }

  count(): i32 {
    let n = 0;
    for (let i = 0; i < this.free.length; i += 1) {
      if (this.free[i]) {
        n += 1;
      }
    }
    return n;
  }
}

const filled = (n: i32): boolean[] => {
  const arr = new Array<boolean>(n);
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = true;
  }
  return arr;
};

export const main = (): number => {
  const r = new Rows();
  console.log(`${r.count()} ${r.free.length}`);
  r.fill(8);
  r.free[3] = false;
  console.log(`${r.count()} ${r.free.length}`);
  r.fill(16);
  console.log(`${r.count()} ${r.free.length}`);
  return 0;
};
