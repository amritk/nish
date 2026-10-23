// A variable the loop condition only tests, never writes, is still narrowed
// after the loop by the condition being false.
enum Kind {
  A,
  B,
  C,
}

const g = (k: Kind, n: i32): boolean => {
  let i = 0;
  while (k === Kind.A) {
    i++;
    if (i > n) {
      return true;
    }
  }
  return k === Kind.A;
};

const f = (n: i32): boolean => g(Kind.B, n);

export const main = (): void => {
  console.log(f(2));
};
