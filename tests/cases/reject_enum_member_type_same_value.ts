// Two members of one value are one member type, spelled by the member declared
// first: `Kind.List` is `Kind.Array`, which the message names.
enum Kind {
  Scalar,
  Array,
  List = 1,
}

export const test = (): number => {
  const k: Kind.List = Kind.Scalar;
  return k === Kind.List ? 1 : 0;
};
