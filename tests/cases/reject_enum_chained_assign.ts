// A chained assignment `k = j = Kind.B` leaves `k` holding what `j` was given.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = n > 0 ? Kind.A : Kind.C;
  let k: Kind = Kind.A;
  k = j = Kind.B;
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
