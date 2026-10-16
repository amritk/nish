// Two different member types in one array literal: TypeScript makes the
// element type their union, which is `Kind` itself for an enum of just these
// two members, and the language asks for that annotation.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const xs = [a, b];
  return b;
};
