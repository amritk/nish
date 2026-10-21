// `let j = k` where `k` is narrowed to `Kind.A` infers `Kind.A`, as tsc does,
// so assigning `Kind.B` to it is TS2322.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (k: Kind): i32 => {
  if (k === Kind.A) {
    let j = k;
    j = Kind.B;
    return j === Kind.B ? 1 : 0;
  }
  return 0;
};

export const main = (): void => {
  console.log(f(pick(1)));
};
