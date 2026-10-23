// An `if` that returns inside a `do` narrows a variable the loop never writes,
// at the head and after the loop.
enum Kind {
  A,
  B,
  C,
}

const g = (k: Kind, n: i32): boolean => {
  let i = 0;
  do {
    if (k === Kind.A) {
      return true;
    }
    i++;
  } while (i < n);
  return k === Kind.A;
};

const f = (n: i32): boolean => g(Kind.B, n);

export const main = (): void => {
  console.log(f(2));
};
