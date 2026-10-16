// A member type one array deep in a ternary: `[a]` is a `Kind.Array[]` and
// `[k]` a `Kind[]`, so the variable is annotated `Kind[]`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const ys = c ? [a] : [k];
  return b;
};
