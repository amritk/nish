// The program's first `Base`: refused against `pa`'s.
class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const fa = (): i32 => new Base(1).x;
