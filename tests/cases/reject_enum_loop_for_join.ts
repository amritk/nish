// The last store of an iteration is what reaches the next: after the `for`,
// `j` is `Kind.A | Kind.C`, never `Kind.B`.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    j = Kind.B;
    j = Kind.C;
  }
  return j === Kind.B;
};

export const main = (): void => {
  console.log(f(2));
};
