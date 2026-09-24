// The root package's first `Box<T>`: refused against `p`'s.
class Box<T> {
  lead: i32;
  v: T;

  constructor(v: T) {
    this.lead = 2;
    this.v = v;
  }
}

export const fx = (): i32 => new Box<i32>(3).v;
