// NL2519 through an arrow's result into an unannotated `let`: `apply` binds
// `U` to `Kind.Array`, so `z` holds only that member.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function apply<T, U>(x: T, f: (x: T) => U): U {
  return f(x);
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  let z = apply(a, (k) => k);
  z = Kind.Scalar;
  return b;
};
