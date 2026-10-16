// An enum member does not initialise a number field: `Kind` is not `i32`,
// though it lowers to one.
enum Kind {
  Scalar,
  Array,
}

class Counter {
  n: i32 = Kind.Array;
}

export const test = (): number => new Counter().n;
