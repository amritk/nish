// NL2519 on an array literal: each element enters a `Kind.Array` slot.
enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const a: Kind.Array[] = [Kind.Array, Kind.Scalar];
  return a.length;
};
