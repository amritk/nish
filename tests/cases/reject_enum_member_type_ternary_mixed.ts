// Two different member types in one ternary are a union in TypeScript, which
// the language has no type for: the variable is annotated instead.
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
