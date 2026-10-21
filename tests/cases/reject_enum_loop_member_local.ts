// A local of a member type is that member: the loop pass reads `k = m` as
// `Kind.B`, as the checker does, so `k === Kind.A` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  const m: Kind.B = Kind.B;
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = m;
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
