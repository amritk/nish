// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// A passed bounds check proves the same index on the same array for as long as
// nothing could change either. AWFY Permute's `swap` on a field array: four
// accesses, and only the first read of each index keeps its check. The emitter
// checks `this.v[j]` (the value) before `this.v[i]` (the store), so the
// store is proven by the `tmp` read above it and `this.v[j] = tmp` by the read
// of `this.v[j]` on the line before. A compound assignment checks before it
// loads and before its right operand runs, so `this.v[i] += this.v[i]`
// carries one check between the two, and the second read of it is proven.
class Perm {
  v: i32[];

  constructor(n: i32) {
    this.v = new Array<i32>(n);
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i];
    this.v[i] = this.v[j];
    this.v[j] = tmp;
  }

  double(i: i32): i32 {
    this.v[i] += this.v[i];
    return this.v[i];
  }
}

export const test = (): number => {
  const p = new Perm(4);
  p.v[0] = 1;
  p.v[3] = 20;
  p.swap(0, 3);
  return p.double(3) + p.v[0];
};
