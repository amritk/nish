// Past an `if` or a `switch` none of whose arms assigns a variable, the
// variable holds what the tests along each way out left it, joined.
enum Kind {
  A,
  B,
  C,
}

class VA {
  readonly kind: Kind.A = Kind.A;
  a: i32 = 1;
}

class VB {
  readonly kind: Kind.B = Kind.B;
  b: i32 = 2;
}

class VC {
  readonly kind: Kind.C = Kind.C;
  c: i32 = 3;
}

type U = VA | VB | VC;

// Both arms leave unless `s` is a `VC`, so `s.c` reads after the `if`.
const m = (s: U, c: boolean): i32 => {
  if (c) {
    if (s.kind !== Kind.C) {
      return 0;
    }
  } else {
    if (s.kind !== Kind.C) {
      return 1;
    }
  }
  return s.c;
};

// Each way out of the `switch` passed a test that left unless `s` is a `VB`.
const w = (s: U, n: i32): i32 => {
  switch (n) {
    case 1:
      if (s.kind !== Kind.B) {
        return 0;
      }
      break;
    case 2:
      if (s.kind !== Kind.B) {
        return 1;
      }
      break;
    default:
      return 2;
  }
  return s.b;
};

// An arm with no test keeps every member, so `k === Kind.A` may still hold.
const e = (k: Kind, c: boolean): boolean => {
  if (c) {
    if (k === Kind.A) {
      return false;
    }
  }
  return k === Kind.A;
};

// So does a clause with no test.
const x = (k: Kind, n: i32): boolean => {
  switch (n) {
    case 1:
      break;
    default:
      if (k === Kind.A) {
        return true;
      }
      break;
  }
  return k === Kind.A;
};

// Ruled out above the `if` and in both arms, `k` is `Kind.C` after it.
const o2 = (k: Kind, c: boolean): boolean => {
  if (k === Kind.A) {
    return false;
  }
  if (c) {
    if (k === Kind.B) {
      return false;
    }
  } else {
    if (k === Kind.B) {
      return true;
    }
  }
  return k === Kind.C;
};

// An `else if` chain with no final `else` keeps the way past every test.
const ei2 = (k: Kind, n: i32): boolean => {
  if (n === 1) {
    if (k === Kind.A) {
      return false;
    }
  } else if (n === 2) {
    if (k === Kind.A) {
      return true;
    }
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(m(new VC(), true));
  console.log(m(new VA(), false));
  console.log(w(new VB(), 2));
  console.log(w(new VA(), 1));
  console.log(e(Kind.A, false));
  console.log(x(Kind.A, 1));
  console.log(o2(Kind.C, true));
  console.log(ei2(Kind.A, 3));
};
