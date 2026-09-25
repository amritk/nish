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
