// WP15 §8, the false-positive guards for the struct-padding warning. Every
// struct here is already as small as its fields can make it, or has an order
// that is not the author's to change, so none of them may say anything — the
// obligation §8 puts on the class: a warning nobody can act on teaches people
// to ignore all ten of them.

// Already widest first. There is nothing to move.
export class Packed {
  size: f64 = 0;
  count: i32 = 0;
  flag: boolean = false;
}

// One alignment throughout, so every order is the same size.
export class Uniform {
  a: i32 = 0;
  b: i32 = 0;
  c: i32 = 0;
}

// One field: there is no other order to name.
export class Single {
  only: boolean = false;
}

// Eight bytes with three unreachable, and eight with the `i32` first as well:
// this padding is the alignment's and not the order's, which is why the rule
// compares the rounded sizes rather than counting gaps.
export class Unavoidable {
  flag: boolean = false;
  count: i32 = 0;
}

// `implements` makes the interface's fields the class's *first* fields, in
// order (WP25), so `Entry`'s prefix is not the author's to permute: its 24
// bytes really would be 16 reordered, and naming that order would be advice
// that stops the program compiling.
export interface Header {
  live: boolean;
  weight: f64;
}

export class Entry implements Header {
  live: boolean = false;
  weight: f64 = 0;
  index: i32 = 0;
}

// A generic instantiation shares one declaration with every other one, so the
// caret would land on this `class` once per type argument and the order that
// suits one need not suit another. `Cell<f64>` is 24 bytes and 16 packed, and
// is silent because the struct the layout belongs to is `Cell$f64`.
export class Cell<T> {
  used: boolean = false;
  value: T;
  tag: i32 = 0;
  constructor(value: T) {
    this.value = value;
  }
}

export const test = (): number => {
  const p = new Packed();
  const u = new Uniform();
  const s = new Single();
  const v = new Unavoidable();
  const e = new Entry();
  const c = new Cell<f64>(toF64(4));
  return p.count + u.c + v.count + e.index + c.tag + (s.only ? 1 : 2) + toI32(c.value);
};
