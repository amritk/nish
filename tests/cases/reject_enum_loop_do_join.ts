// A `do` body always runs, so what held before it does not reach its end:
// `j` is `Kind.B` after the loop.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  do {
    j = Kind.B;
    i++;
  } while (i < n);
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
