// NL2519 on a generic call whose `T` the array binds: `xs` is a
// `Kind.Array[]`, so `init` takes only that member.
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
  const y: Kind.Array = fold(xs, Kind.Scalar);
  return b;
};
