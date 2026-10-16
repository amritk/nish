// NL2514 on a ternary arm: each arm enters the `Kind.Array` the arrow returns.
enum Kind {
  Scalar,
  Array,
}


const pick = (b: boolean): Kind.Array => (b ? Kind.Array : Kind.Scalar);

export const test = (): number => (pick(true) === Kind.Array ? 1 : 0);
