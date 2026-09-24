// A generic class instantiated at `i32` by a signature, so `Box$i32` exists
// before any body is checked.
export class Box<T> {
  lead: i32;
  v: T;

  constructor(v: T) {
    this.lead = 9;
    this.v = v;
  }
}

export const rd = (b: Box<i32>): i32 => b.v;
