// A limit: `T` is bound by the constant before the function argument is
// read, so `apply(take, Kind.Array)` binds it to `Kind`, and `take` is not a
// `(x: Kind) => Kind` (TypeScript binds `T` from `take`). `apply(take, a)`
// binds it to `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function take(x: Kind.Array): Kind.Array {
  return x;
}

function apply<T>(f: (x: T) => T, x: T): T {
  return f(x);
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const y: Kind.Array = apply(take, Kind.Array);
  return b;
};
