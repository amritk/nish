// `const IDX: i32 = 0` keys `xs[IDX]` by its value, so a second test of it is refused, as in tsc.
enum Kind {
  A,
  B,
}

const IDX: i32 = 0;

const f = (xs: Kind[]): boolean => {
  if (xs[IDX] === Kind.A) {
    return true;
  }
  return xs[IDX] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
