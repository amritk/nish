// NL2519 on a method of a generic class bound to `Kind.Array`: `with`'s `x`
// is a `T`, which is that member.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
class Box<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
  with(x: T): T {
    return x;
  }
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const box = new Box<Kind.Array>(a);
  const r = box.with(Kind.Scalar);
  return b;
};
