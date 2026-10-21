// Two module constants initialised with `-1` key one element, as they do to tsc.
enum Kind {
  A,
  B,
}

const A: i32 = -1;
const B: i32 = -1;

const f = (xs: Kind[]): boolean => {
  if (xs[A] === Kind.A) {
    return true;
  }
  return xs[B] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
