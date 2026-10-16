// NL2519 through a ternary: `c ? a : a` is a `Kind.Array`, so the unannotated
// `let` holds that member, as in TypeScript, and another does not enter it.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  let x = c ? a : a;
  x = Kind.Scalar;
  return b;
};
