// A method whose return type is a member reads as that member: `k` leaves the
// `do` as `Kind.B`, and `k === Kind.A` is always false.
enum Kind {
  A,
  B,
  C,
}

class H {
  get(): Kind.B {
    return Kind.B;
  }
}

const f = (h: H, n: i32): boolean => {
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = h.get();
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(new H(), 3));
};
