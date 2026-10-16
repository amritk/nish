// A member type names one member of one enum, so `Kind.Array.Inner` is not
// a type: the parser stops at the second dot.
enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const k: Kind.Array.Inner = Kind.Array;
  return k === Kind.Array ? 1 : 0;
};
