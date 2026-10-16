// NL2519 through a ternary passed to a generic function: `id(c ? a : a)`
// binds `T` to `Kind.Array`, as `id(a)` does.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function id<T>(x: T): T {
  return x;
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const y = id(c ? a : a);
  let z = y;
  z = Kind.Scalar;
  return b;
};
