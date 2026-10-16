// NL2519 through an array literal passed to a generic function: `g([a])`
// binds `T` to `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function g<T>(xs: T[]): T[] {
  return xs;
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const ys = g([a]);
  ys.push(Kind.Scalar);
  return b;
};
