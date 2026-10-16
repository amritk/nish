// NL2514 on a generic call: `tag`'s `k` is a `Kind.Array` beside a type
// parameter, and another member does not enter it.
enum Kind {
  Scalar,
  Array,
}

function tag<T>(x: T, k: Kind.Array): Kind.Array {
  return k;
}

export const test = (): number => (tag(3, Kind.Scalar) === Kind.Array ? 1 : 0);
