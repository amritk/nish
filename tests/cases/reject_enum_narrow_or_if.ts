// The true side of `k === Kind.A || k === Kind.B` leaves `k` one of the two, so `k === Kind.C`
// there is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
  D,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : n === 2 ? Kind.C : Kind.D);

const f = (k: Kind): i32 => {
  if (k === Kind.A || k === Kind.B) {
    return k === Kind.C ? 1 : 0;
  }
  return 2;
};

export const main = (): void => {
  console.log(f(pick(1)));
};
