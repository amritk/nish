// This code is derived from the SOM benchmarks, see bench/awfy/AUTHORS.md.
// Copyright (c) 2015-2016 Stefan Marr; MIT licence, reproduced in bench/awfy/LICENSE.md.

// An element store beside the class field that holds the array.
export class Perm {
  v: i32[];

  constructor() {
    this.v = [];
  }

  swap(i: i32, j: i32): void {
    const tmp = this.v[i];
    this.v[i] = this.v[j];
    this.v[j] = tmp;
  }
}
