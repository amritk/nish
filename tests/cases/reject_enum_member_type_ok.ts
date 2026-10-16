// NL2519 on `Ok`: the value of a `Result<Kind.Array, string>` holds only that member.
enum Kind {
  Scalar,
  Array,
}

const make = (): Result<Kind.Array, string> => Ok(Kind.Scalar);

export const test = (): number => (make().unwrapOr(Kind.Array) === Kind.Array ? 1 : 0);
