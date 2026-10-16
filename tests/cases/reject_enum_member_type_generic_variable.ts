// A value of the enum, not a constant, into a generic slot the array binds
// to `Kind.Array`: `k` may hold any member.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function fold<T>(xs: T[], init: T): T {
  return xs.length > 0 ? xs[0] : init;
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const xs: Kind.Array[] = [a];
  const y: Kind.Array = fold(xs, k);
  return b;
};
