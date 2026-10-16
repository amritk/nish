// An arrow's result is an inferred position, as TypeScript reads it: `(k) => k`
// over a `Kind.Array` answers a `Kind.Array`, so `map([a], (k) => k)` is a
// `Kind.Array[]` and `apply(a, (k) => k)` a `Kind.Array`, and each goes back
// into a member slot. An arrow that answers the constant, `(k) => Kind.Array`,
// answers `Kind`, as TypeScript widens it, so its array takes any member.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;

function map<T, U>(xs: T[], f: (x: T) => U): U[] {
  const out: U[] = [];
  for (const x of xs) {
    out.push(f(x));
  }
  return out;
}

function apply<T, U>(x: T, f: (x: T) => U): U {
  return f(x);
}

export const test = (): number => {
  const a: Kind.Array = array();
  const ys: Kind.Array[] = map([a, a], (k) => k);
  let z = apply(a, (k) => k);
  z = Kind.Array;
  const w: Kind.Array = apply(a, (k) => (k === Kind.Array ? k : k));
  const zs = map([a], (k) => Kind.Array);
  zs.push(Kind.Scalar);
  let same = 0;
  for (const k of [ys[0], ys[1], z, w]) {
    same = same + (k === Kind.Array ? 1 : 0);
  }
  return same * 10 + zs.length + (zs[1] === Kind.Scalar ? 100 : 0);
};
