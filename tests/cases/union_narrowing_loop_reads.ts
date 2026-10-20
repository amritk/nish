// Narrowed reads after and inside loops that TypeScript accepts: a copy, a
// ternary and a union's tag stored in the body, and variables the loop only
// tests, through `while`, `do`, `for`, `for-of` and a `switch`.
enum Kind {
  A,
  B,
  C,
}

class S {
  readonly kind: Kind.A = Kind.A;
  s: i32 = 1;
}

class T {
  readonly kind: Kind.B = Kind.B;
  t: i32 = 20;
}

class V {
  readonly kind: Kind.C = Kind.C;
  v: i32 = 300;
}

type U = S | T | V;

// The store copies `j`, which is `Kind.B | Kind.C` here; before the loop `k`
// is `Kind.A`, so after it `k` may be any of the three.
const copyWhile = (n: i32, j: Kind): boolean => {
  if (j === Kind.A) {
    return true;
  }
  let k: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    k = j;
    i++;
  }
  return k === Kind.A;
};

const ternaryFor = (n: i32): string => {
  let k: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    k = i > 1 ? Kind.B : Kind.C;
  }
  if (k === Kind.A) {
    return "A";
  }
  return k === Kind.B ? "B" : "C";
};

const tagCopyFor = (u: U, n: i32): boolean => {
  if (u.kind === Kind.A) {
    return true;
  }
  let k: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    k = u.kind;
  }
  return k === Kind.A;
};

// `k` is only tested; the arms that return leave `Kind.B | Kind.C` at the
// head, and a read inside the body compares within that.
const testedDo = (k: Kind, n: i32): i32 => {
  let i = 0;
  let seen = 0;
  do {
    if (k === Kind.A) {
      return -1;
    }
    if (k === Kind.B) {
      seen++;
    }
    i++;
  } while (i < n);
  return seen;
};

const testedForOf = (k: Kind, xs: i32[]): i32 => {
  let total = 0;
  for (const x of xs) {
    if (k === Kind.A || x < 0) {
      return -1;
    }
    total += k === Kind.C ? x * 10 : x;
  }
  return total;
};

const testedNestedBreak = (k: Kind, n: i32): boolean => {
  let i = 0;
  while (i < n) {
    if (i > 0) {
      if (k === Kind.A) {
        return true;
      }
    } else {
      if (k === Kind.A) {
        return false;
      }
    }
    i++;
    if (i > 3) {
      break;
    }
  }
  return k === Kind.B;
};

// The clauses swap `k` between `Kind.B` and `Kind.C`; the default returns.
const switchSwap = (n: i32): string => {
  let k: Kind = Kind.B;
  let i = 0;
  while (i < n) {
    switch (k) {
      case Kind.B:
        k = Kind.C;
        break;
      case Kind.C:
        k = Kind.B;
        break;
      default:
        return "A";
    }
    i++;
  }
  return k === Kind.B ? "B" : "C";
};

const unionTestedWhile = (u: U, n: i32): i32 => {
  let i = 0;
  while (u.kind === Kind.A) {
    i++;
    if (i > n) {
      return u.s;
    }
  }
  if (u.kind === Kind.B) {
    return u.t;
  }
  return u.v;
};

const pick = (i: i32): U => {
  if (i === 0) {
    return new S();
  }
  return i === 1 ? new T() : new V();
};

export const main = (): void => {
  console.log(`${copyWhile(2, Kind.B)} ${copyWhile(0, Kind.C)} ${copyWhile(1, Kind.A)}`);
  console.log(`${ternaryFor(0)} ${ternaryFor(2)} ${ternaryFor(3)}`);
  console.log(`${tagCopyFor(pick(1), 2)} ${tagCopyFor(pick(2), 0)} ${tagCopyFor(pick(0), 1)}`);
  console.log(`${testedDo(Kind.B, 3)} ${testedDo(Kind.C, 3)} ${testedDo(Kind.A, 3)}`);
  console.log(`${testedForOf(Kind.B, [1, 2, 3])} ${testedForOf(Kind.C, [1, 2, 3])} ${testedForOf(Kind.C, [1, -2])}`);
  console.log(`${testedNestedBreak(Kind.B, 9)} ${testedNestedBreak(Kind.C, 2)} ${testedNestedBreak(Kind.A, 2)}`);
  console.log(`${switchSwap(0)} ${switchSwap(1)} ${switchSwap(4)}`);
  console.log(`${unionTestedWhile(pick(0), 2)} ${unionTestedWhile(pick(1), 2)} ${unionTestedWhile(pick(2), 2)}`);
};
