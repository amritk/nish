// A `for` leaves when its condition fails, after the update ran: `k` is
// `Kind.A` then, never `Kind.C`, so `k === Kind.C` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let k: Kind = Kind.C;
  let i = n;
  for (; k === Kind.C; k = Kind.A) {
    i++;
  }
  return k === Kind.C;
};

export const main = (): void => {
  console.log(f(2));
};
