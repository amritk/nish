// A member type beside a value of its enum: TypeScript widens the ternary
// to `Kind`, and the language asks for that type to be written.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const t = c ? a : k;
  return b;
};
