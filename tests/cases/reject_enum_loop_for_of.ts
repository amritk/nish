// A `for...of` leaves what reaches its head: `j` is `Kind.A | Kind.B`.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  for (const x of [1, 2]) {
    if (x > n) {
      j = Kind.B;
    }
  }
  return j === Kind.C;
};

export const main = (): void => {
  console.log(f(2));
};
