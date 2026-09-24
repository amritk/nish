// WP15 §8, NL9010 on a class whose interface prefix ends off alignment (#108).
// Widest first is the best order only from an offset aligned to the widest
// field. After a prefix that ends at 1 or 4 there is a gap, and narrow fields
// the class adds can fill it. So the rule lays the suffix out from where the
// prefix ends, taking the field that pads least each time, and names that
// order and the size it measures to.
//
// `Four` is 32 bytes as declared, and widest first (`b, d, c`) it is 32 too.
// With `c` in the four bytes after `a` it is 24.
export interface Four {
  a: i32;
}

export class FourGap implements Four {
  a: i32 = 0;
  b: f64 = 0;
  c: i32 = 0;
  d: f64 = 0;
}

// A one-byte prefix leaves seven bytes. `c` takes one of them and `d` the four
// at offset 4: 24 bytes. As declared it is 32, and widest first it is 32 too.
export interface One {
  a: boolean;
}

export class OneGap implements One {
  a: boolean = false;
  b: f64 = 0;
  c: boolean = false;
  d: i32 = 0;
  e: f64 = 0;
}

// Every width at once. `Mixed` is 56 bytes as declared, and widest first after
// `a` it is 48, because seven bytes are still lost after `a`. Filling the gap narrowest first, `r`
// then `u` then `f`, reaches offset 8 with nothing wasted, and it is 40.
export class Item {
  id: i32 = 0;
}

export class Mixed implements One {
  a: boolean = false;
  u: u16 = 0;
  s: string = "";
  r: u8 = 0;
  xs: i32[];
  f: f32 = 0;
  n: Item | null = null;
  q: i64 = 0;

  constructor() {
    this.xs = [];
  }
}

export const test = (): number => {
  const four = new FourGap();
  four.c = 2;
  const one = new OneGap();
  one.d = 3;
  const mixed = new Mixed();
  mixed.r = 4;
  const view: One = mixed;
  return four.c + one.d + toI32(mixed.r) + (view.a ? 1 : 0) + mixed.xs.length;
};
