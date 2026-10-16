// NL2514 on a `return` statement of a function answering `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const tag = (): Kind.Array => {
  return Kind.Scalar;
};

export const test = (): number => (tag() === Kind.Array ? 1 : 0);
