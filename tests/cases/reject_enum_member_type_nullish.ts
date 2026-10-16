// NL2519 through `??`: both sides are `Kind.Array[]`, and so is `x`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const m: Kind.Array[] | null = c ? [a] : null;
  let x = m ?? [a];
  x.push(Kind.Scalar);
  return b;
};
