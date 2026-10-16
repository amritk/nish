// NL2514 on `unwrapOr`: its default is a value of the `Ok` type, here `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const make = (): Result<Kind.Array, string> => Ok(Kind.Array);

export const test = (): number => {
  const k: Kind.Array = make().unwrapOr(Kind.Scalar);
  return k === Kind.Array ? 1 : 0;
};
