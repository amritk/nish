// A member type beside a constant in an array literal: TypeScript widens the
// fresh constant, and the element type with it, to `Kind`, which the language
// does not do to a member type unasked, so it asks for `Kind[]` to be written.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const xs = [a, Kind.Array];
  return b;
};
