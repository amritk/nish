// The `else` of `k === Kind.A` leaves `k` `Kind.B | Kind.C`, so testing it
// against `Kind.A` again is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (k: Kind): i32 => {
  if (k === Kind.A) {
    return 0;
  } else {
    return k === Kind.A ? 1 : 2;
  }
};

export const main = (): void => {
  console.log(f(pick(1)));
};
