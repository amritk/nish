// The loop accept-gap (docs/LANGUAGE.md, "Accepted here, refused by tsc"):
// after a loop, a variable or path holds every member the body wrote
// anywhere in it, not only what reaches the end of an iteration, so each
// comparison below compiles here and is TS2367 to `tsc`. The expected
// errors keep `tsc` quiet and fail once it accepts them; once the gap
// closes, this case is refused here and moves to `reject_`.
enum Kind {
  A,
  B,
  C,
}

class H {
  k: Kind = Kind.A;
  constructor(k: Kind) {
    this.k = k;
  }
}

const whileLoop = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    j = Kind.B;
    j = Kind.C;
    i++;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.C`, the loop accept-gap
  return j === Kind.B;
};

const doLoop = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  do {
    j = Kind.B;
    i++;
  } while (i < n);
  // @ts-expect-error TS2367: `j` is `Kind.B`, the loop accept-gap
  return j === Kind.A;
};

const forLoop = (n: i32): boolean => {
  let j: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    j = Kind.B;
    j = Kind.C;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.C`, the loop accept-gap
  return j === Kind.B;
};

const pathLoop = (h: H, n: i32): boolean => {
  h.k = Kind.A;
  let i = 0;
  while (i < n) {
    h.k = Kind.B;
    h.k = Kind.C;
    i++;
  }
  // @ts-expect-error TS2367: `h.k` is `Kind.A | Kind.C`, the loop accept-gap
  return h.k === Kind.B;
};

export const main = (): void => {
  console.log(whileLoop(2));
  console.log(doLoop(2));
  console.log(forLoop(2));
  console.log(pathLoop(new H(Kind.A), 2));
};
