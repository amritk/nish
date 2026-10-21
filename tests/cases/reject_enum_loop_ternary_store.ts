// A ternary of members stored in a `do` body holds both arms at the head, never
// what the variable held before the loop.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = i > 1 ? Kind.B : Kind.C;
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
