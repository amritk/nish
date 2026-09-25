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
}
