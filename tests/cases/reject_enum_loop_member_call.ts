// A function that returns a member type gives that member: `k = pickB()`
// leaves `k` as `Kind.B`, and `k === Kind.A` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const pickB = (): Kind.B => Kind.B;

const f = (n: i32): boolean => {
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = pickB();
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
