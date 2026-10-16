// NL2515: a zero-filled array of a member type whose value is not 0.
enum Kind {
  Scalar,
  Array,
}

export const main = (): i32 => {
  const a = new Array<Kind.Array>(2);
  return a.length;
};
