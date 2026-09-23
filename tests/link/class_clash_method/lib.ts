// A class `Counter` with a method `bump`, and no constructor.
export class Counter {
  n: i32 = 0;

  bump(): i32 {
    this.n = this.n + 1;
    return this.n;
  }
}

export const one = (): i32 => 1;
