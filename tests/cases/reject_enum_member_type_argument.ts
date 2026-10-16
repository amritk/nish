// NL2514 on a call argument: the parameter is a `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}


const keep = (k: Kind.Array): Kind.Array => k;

export const test = (): number => (keep(Kind.Scalar) === Kind.Array ? 1 : 0);
