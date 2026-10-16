// Two different member types in one ternary are their union in TypeScript,
// which is `Kind` itself for an enum of just these two members: the language
// asks for that annotation.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  let x = c ? a : b;
  x = Kind.Scalar;
  return b;
};
