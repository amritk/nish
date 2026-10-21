// Every arm of an `else if` chain with a final `else` rules `Kind.A` out.
enum Kind {
  A,
  B,
  C,
}

const ei = (k: Kind, n: i32): boolean => {
  if (n === 1) {
    if (k === Kind.A) {
      return false;
    }
  } else if (n === 2) {
    if (k === Kind.A) {
      return true;
    }
  } else {
    if (k === Kind.A) {
      return true;
    }
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(ei(Kind.B, 1));
};
