// A member type beside a constant: TypeScript keeps `Kind.Array` when the
// constant is that member and widens to `Kind` when it is another, so the
// language asks for the type rather than pick one.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  let x = c ? a : Kind.Array;
  x = Kind.Array;
  return b;
};
