// NL2518: a member type naming a member the enum does not declare.
enum Kind {
  Scalar,
}

export const main = (): i32 => {
  const k: Kind.Array = Kind.Scalar;
  return 0;
};
