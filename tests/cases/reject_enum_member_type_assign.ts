// NL2514 on an assignment to a `let` of the member type.
enum Kind {
  Scalar,
  Array,
}


export const test = (): number => {
  let k: Kind.Array = Kind.Array;
  k = Kind.Scalar;
  return k === Kind.Array ? 1 : 0;
};
