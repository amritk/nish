// `(k = pick(n + 1)) === Kind.A` tests the `k` the assignment just wrote, so inside the `if`
// `k === Kind.B` is always false, as tsc's TS2367 says.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (n: i32): i32 => {
  let k: Kind = pick(n);
  if ((k = pick(n + 1)) === Kind.A) {
    return k === Kind.B ? 1 : 0;
  }
  return k === Kind.C ? 3 : 2;
};

export const main = (): void => {
  console.log(f(1));
};
