// Each arm of a ternary is read on its side of the condition: the false arm
// has `k` narrowed past `Kind.A`, so `j` is never `Kind.A` after the loop.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, n: i32): boolean => {
  let i = 0;
  let j: Kind = Kind.A;
  do {
    j = k === Kind.A ? Kind.B : k;
    i++;
  } while (i < n);
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.C, 2));
};
