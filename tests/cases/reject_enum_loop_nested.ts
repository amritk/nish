// A loop inside the loop runs to its own fixpoint: what leaves the inner
// `while` is `Kind.A | Kind.C`, and so is what leaves the outer one.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    i++;
    let m = 0;
    while (m < n) {
      m++;
      j = Kind.B;
      j = Kind.C;
    }
  }
  return j === Kind.B;
};

export const main = (): void => {
  console.log(f(2));
};
