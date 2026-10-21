// What a loop leaves a union or enum variable holding is what reaches its
// ways out: the condition false, a `break`, or the end of a `do` body. Each
// comparison below names a member that one of those ways can hold, so each
// compiles, under `tsc` too, and prints what the loop computed.
enum Kind {
  A,
  B,
  C,
}

class Ca {
  readonly kind: Kind.A = Kind.A;
}
class Cb {
  readonly kind: Kind.B = Kind.B;
}
class Cc {
  readonly kind: Kind.C = Kind.C;
}
type S = Ca | Cb | Cc;

const make = (n: i32): S => {
  if (n === 0) {
    return new Ca();
  }
  if (n === 1) {
    return new Cb();
  }
  return new Cc();
};

// The condition false leaves `Kind.C`.
const untilDone = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (j !== Kind.C) {
    if (i > n) {
      j = Kind.C;
    } else {
      j = Kind.B;
    }
    i++;
  }
  return j === Kind.C;
};

// The `break` leaves `Kind.B`, the condition `Kind.A | Kind.B`.
const breakOut = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    i++;
    if (j === Kind.B) {
      break;
    }
    j = Kind.B;
  }
  return j === Kind.A;
};

// A `continue` carries `Kind.C` to the head.
const continueOn = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    i++;
    if (i === 2) {
      j = Kind.C;
      continue;
    }
    j = Kind.B;
  }
  return j === Kind.C;
};

// Each arm of the `switch` reaches its end.
const switchArms = (k: Kind, n: i32): boolean => {
  let j: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    switch (k) {
      case Kind.A:
        j = Kind.C;
        break;
      default:
        j = Kind.B;
    }
  }
  return j === Kind.C;
};

// The inner loop's store reaches the outer loop's end.
const nested = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    i++;
    let m = 0;
    while (m < n) {
      m++;
      j = Kind.C;
    }
  }
  return j === Kind.C;
};

// A `do` body's test reads what the last iteration left.
const doAlternate = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  do {
    i++;
    if (j === Kind.A) {
      j = Kind.B;
    } else {
      j = Kind.C;
    }
  } while (i < n);
  return j === Kind.C;
};

// The narrowing at the head holds while the condition does.
const conditionStore = (k: Kind, n: i32): boolean => {
  let j: Kind = k;
  let i = 0;
  while (j === Kind.A) {
    i++;
    j = i > n ? Kind.B : Kind.A;
  }
  return j === Kind.B;
};

// A `for...of` leaves what reaches its head.
const forOf = (n: i32): boolean => {
  let j: Kind = Kind.A;
  for (const x of [1, 2, 3]) {
    if (x > n) {
      j = Kind.B;
    }
  }
  return j === Kind.B;
};

// An unconditional loop is left only by its `break`.
const forever = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (true) {
    i++;
    if (i > n) {
      break;
    }
    j = Kind.C;
  }
  return j === Kind.C;
};

// A union variable the body stores widens to what `make` returns.
const unionStore = (n: i32): boolean => {
  let u: S = make(0);
  let i = 0;
  while (i < n) {
    u = make(1);
    u = make(i + 2);
    i++;
  }
  return u.kind === Kind.B;
};

export const main = (): void => {
  console.log(untilDone(3));
  console.log(breakOut(3));
  console.log(continueOn(3));
  console.log(switchArms(Kind.A, 2));
  console.log(nested(2));
  console.log(doAlternate(3));
  console.log(conditionStore(Kind.A, 2));
  console.log(forOf(2));
  console.log(forever(2));
  console.log(unionStore(2));
};
