// NL2514 on an inferred `let`: initialised from a `Kind.Array`, it keeps that
// member type, as tsc's would, so another member does not enter it.
enum Kind {
  Scalar,
  Array,
}

const keep = (k: Kind.Array): Kind.Array => k;

export const test = (): number => {
  let w = keep(Kind.Array);
  w = Kind.Scalar;
  return w === Kind.Scalar ? 1 : 0;
};
