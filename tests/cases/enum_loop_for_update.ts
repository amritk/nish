// A `for`'s update runs after the body and before the next test, so the body's
// first pass sees what the loop began with and later passes what the update
// stored: each test here reads `k` as `Kind.C` or `Kind.A`, never as one alone.
enum Kind {
  A,
  B,
  C,
}

const first = (n: i32): boolean => {
  let k: Kind = Kind.C;
  let r = false;
  for (let i = 0; i < n; k = Kind.A) {
    r = k === Kind.C;
    i++;
  }
  return r;
};

const counted = (n: i32): i32 => {
  let k: Kind = Kind.C;
  let r = 0;
  for (let i = 0; i < n; k = Kind.A) {
    switch (k) {
      case Kind.C:
        r = r + 1;
        break;
      case Kind.A:
        r = r + 10;
        break;
      default:
        r = r + 100;
    }
    i++;
  }
  return r;
};

const changed = (n: i32): boolean => {
  let k: Kind = Kind.C;
  let r = false;
  for (let i = 0; i < n; k = Kind.B) {
    r = k !== Kind.C;
    i++;
  }
  return r;
};

export const main = (): void => {
  console.log(first(1));
  console.log(first(2));
  console.log(counted(3));
  console.log(changed(1));
  console.log(changed(2));
};
