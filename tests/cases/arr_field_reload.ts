// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// An element store cannot write the class field that holds the array. AWFY's
// Permute.swap is this shape: before element loads and stores carried a TBAA
// tag of their own, `opt -O3` reloaded `this.v` and its length after the first
// element store and checked `j` a second time. `tests/run.js` pins the
// consequence a golden cannot state: after `opt -O3` `@Swap.swap` loads the
// field once and the length once. `count` is an `i32` field beside `i32`
// elements, so the two share an LLVM type and are told apart by the subtree
// alone.
export class Swap {
  count: i32 = 0;
  v: i32[];

  constructor() {
    this.v = [];
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i];
    this.v[i] = this.v[j];
    this.v[j] = tmp;
    this.count = this.count + 1;
  }
}

export const test = (): i32 => {
  const s = new Swap();
  s.v = [1, 2, 3];
  s.swap(0, 2);
  s.swap(1, 2);
  return s.v[0] * 1000 + s.v[1] * 100 + s.v[2] * 10 + s.count;
};
