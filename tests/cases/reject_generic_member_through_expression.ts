// WP18 G6: a `T` that reaches a receiver through an expression rather than a
// declaration is still a `T`. `new Box<T>(t)` is an instantiation written out
// exactly as an annotation `Box<T>` is, and an array literal is an array of
// what its elements are, so each of these is refused — a read, a write and a
// method call through `new Box<T>`, one against a constraint that lacks the
// member, and a read out of `[t]`. `concrete` does the same things at `Point`
// and is accepted: the `6 errors` in the `.err` is what says so.
interface Point2 {
  y: i32;
}

class Point implements Point2 {
  y: i32 = 1;
  x: i32 = 2;

  sum(): i32 {
    return this.x + this.y;
  }
}

class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }
}

const viaLocal = <T>(t: T): i32 => {
  const b = new Box<T>(t);
  return b.value.x;
};

const viaNew = <T>(t: T): i32 => new Box<T>(t).value.x;

const viaWrite = <T>(t: T): i32 => {
  const b = new Box<T>(t);
  b.value.x = 1;
  return 0;
};

const viaMethod = <T>(t: T): i32 => {
  const b = new Box<T>(t);
  return b.value.sum();
};

const viaConstraint = <T extends Point2>(t: T): i32 => {
  const b = new Box<T>(t);
  return b.value.x;
};

const viaArray = <T>(t: T): i32 => [t][0].x;

const concrete = (p: Point): i32 => {
  const b = new Box<Point>(p);
  return b.value.x + new Box<Point>(p).value.sum() + [p][0].x;
};

export const test = (): number => {
  const p = new Point();
  return viaLocal(p) + viaNew(p) + viaWrite(p) + viaMethod(p) + viaConstraint(p) + viaArray(p) + concrete(p);
};
