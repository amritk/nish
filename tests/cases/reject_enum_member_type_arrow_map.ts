// NL2519 through an arrow's result: `(k) => k` answers a `Kind.Array`, so
// `map` binds `U` to it and `ys` is a `Kind.Array[]`, as TypeScript infers.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function map<T, U>(xs: T[], f: (x: T) => U): U[] {
  const out: U[] = [];
  for (const x of xs) {
    out.push(f(x));
  }
  return out;
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const ys = map([a], (k) => k);
  ys.push(Kind.Scalar);
  return b;
};
