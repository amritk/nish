// The root package's second `Box<T>`: refused against `x.ts`'s.
class Box<T> {
  v: T;
  tail: i32;

  constructor(v: T) {
    this.v = v;
    this.tail = 4;
  }
}

export const fy = (): i32 => new Box<i32>(5).v;
