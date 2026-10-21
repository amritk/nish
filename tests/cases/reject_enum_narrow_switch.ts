// Under `case Kind.A:` of `switch (k)`, `k` is `Kind.A`, so `k === Kind.B`
// there is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (k: Kind): i32 => {
  switch (k) {
    case Kind.A:
      return k === Kind.B ? 1 : 0;
    default:
      return 2;
  }
};

export const main = (): void => {
  console.log(f(pick(1)));
};
