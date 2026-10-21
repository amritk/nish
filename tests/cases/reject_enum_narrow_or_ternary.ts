// A ternary on `k === Kind.A || k === Kind.B` narrows `k` in its true arm to the two members, so `k
// === Kind.C` there is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
  D,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : n === 2 ? Kind.C : Kind.D);

const f = (k: Kind): i32 => (k === Kind.A || k === Kind.B ? (k === Kind.C ? 1 : 0) : 2);

export const main = (): void => {
  console.log(f(pick(1)));
};
