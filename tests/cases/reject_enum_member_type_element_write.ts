// NL2519 on an element write into a `Kind.Array[]`.
enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const a: Kind.Array[] = [Kind.Array];
  a[0] = Kind.Scalar;
  return a.length;
};
