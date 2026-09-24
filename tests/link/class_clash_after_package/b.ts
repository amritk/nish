// The program's second `Base`: refused against `a.ts`'s.
class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x * 2;
  }
}

export const fb = (): i32 => new Base(1).x;
