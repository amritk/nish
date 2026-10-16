// A limit: the constant is the enum where no argument binds `T`, and the slot
// the call returns into does not bind it, so `id(Kind.Array)` is a `Kind`
// (TypeScript infers `T` from that slot too). `id(a)` is a `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;
function id<T>(x: T): T {
  return x;
}

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const y: Kind.Array = id(Kind.Array);
  return b;
};
