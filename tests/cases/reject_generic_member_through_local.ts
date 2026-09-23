// WP18 G6: a value is `T`-typed however it reached the receiver — a local
// inferred from a `T`, an element of a `T[]`, a `T | null` narrowed to `T`, and
// a field of type `T` read through `this` in a generic class's own method. Each
// reads a different member so the `.err` can tell the four refusals apart.
interface Point {
  a: i32;
  b: i32;
  c: i32;
  d: i32;
}

const viaLocal = <T>(p: T): i32 => {
  const q = p;
  return q.a;
};

const viaElement = <T>(xs: T[]): i32 => xs[0].b;

const viaNarrowing = <T>(p: T | null): i32 => {
  if (p !== null) {
    return p.c;
  }
  return 0;
};

class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  d(): i32 {
    return this.value.d;
  }
}

export const test = (): number => {
  const p: Point = { a: 1, b: 2, c: 3, d: 4 };
  return viaLocal(p) + viaElement([p]) + viaNarrowing(p) + new Box<Point>(p).d();
};
