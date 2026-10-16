// NL2519 through an array literal: `[a]` is a `Kind.Array[]`, as in
// TypeScript, so `push` takes only that member.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const xs = [a];
  xs.push(Kind.Scalar);
  return b;
};
