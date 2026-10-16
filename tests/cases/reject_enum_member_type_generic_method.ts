// A generic method: `put`'s `k` is a `Kind.Array` beside its type parameter.
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
  put<U>(u: U, k: Kind.Array): Kind.Array {
    return k;
  }
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const box = new Box<i32>(1);
  const r = box.put(3, Kind.Scalar);
  return b;
};
