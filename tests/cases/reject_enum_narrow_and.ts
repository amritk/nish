// The right of `k !== Kind.A && ...` runs only where `k` is not `Kind.A`, so
// `k === Kind.A` there is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (k: Kind): i32 => (k !== Kind.A && k === Kind.A ? 1 : 0);

export const main = (): void => {
  console.log(f(pick(1)));
};
