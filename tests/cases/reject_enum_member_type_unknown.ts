// A member type names a member the enum declares.
enum Kind {
  Scalar,
  Array,
}

const missing = (k: Kind.Missing): i32 => 0;

export const test = (): number => missing(Kind.Scalar);
