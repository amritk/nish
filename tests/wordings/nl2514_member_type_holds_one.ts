// NL2514: a slot of an enum member type given another member.
enum Kind {
  Scalar,
  Array,
}

export const main = (): i32 => {
  const k: Kind.Array = Kind.Scalar;
  return k === Kind.Array ? 0 : 1;
};
