// NL2515: `new Array<Kind.Array>(n)` zero-fills, and 0 is `Kind.Scalar`, so
// every slot would hold a member the type refuses.
enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const a = new Array<Kind.Array>(3);
  return a.length;
};
