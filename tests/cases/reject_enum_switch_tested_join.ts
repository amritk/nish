// Every way out of the `switch` passed a test that left when `k` was
// `Kind.A`, so after it `k` cannot be `Kind.A`.
enum Kind {
  A,
  B,
  C,
}

const h = (k: Kind, n: i32): boolean => {
  switch (n) {
    case 1:
      if (k === Kind.A) {
        return false;
      }
      break;
    default:
      if (k === Kind.A) {
        return true;
      }
      break;
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(h(Kind.B, 1));
};
