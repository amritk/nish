// A `const` the loop declares once is read by its initializer: `j` is
// `Kind.B`, so `k` leaves the `do` as `Kind.B` and `k === Kind.A` is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let k: Kind = Kind.A;
  let i = 0;
  do {
    const j: Kind = Kind.B;
    k = j;
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
