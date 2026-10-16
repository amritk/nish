// A member type one array deep: `[a]` is a `Kind.Array[]` and `[Kind.Array]`
// a `Kind[]`, so the outer literal asks for `Kind[][]`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const xs = [[a], [Kind.Array]];
  return b;
};
