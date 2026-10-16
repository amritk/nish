// A slot of an enum member type holds that member and nothing else, so the
// enum's other member is refused where it is checked into the slot.
enum Kind {
  Scalar,
  Array,
}

export const test = (): number => {
  const k: Kind.Array = Kind.Scalar;
  return k === Kind.Array ? 1 : 0;
};
