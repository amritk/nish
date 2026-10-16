// NL2519 through a ternary under a `const`: `x` is a `Kind.Array`, and so is
// the `let` that copies it.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const x = c ? a : a;
  let y = x;
  y = Kind.Scalar;
  return b;
};
