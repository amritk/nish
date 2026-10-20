// A `switch` joins what each of its exits holds: every `break`, the fall off
// its last clause and, with no `default`, the case that matches no clause.
enum Kind {
  A,
  B,
  C,
}

class H {
  k: Kind = Kind.A;
  constructor(k: Kind) {
    this.k = k;
  }
}

// A `break` inside an `if` is an exit of its own.
const early = (k: Kind, c: boolean): boolean => {
  let j: Kind = k;
  switch (j) {
    case Kind.A:
      if (c) {
        j = Kind.B;
        break;
      }
      j = Kind.C;
      break;
    default:
      j = Kind.A;
      break;
  }
  return j === Kind.A;
};

// With no `default`, the unmatched case keeps `Kind.B | Kind.C`.
const unmatched = (k: Kind): boolean => {
  let j: Kind = k;
  switch (j) {
    case Kind.A:
      j = Kind.B;
      break;
  }
  return j === Kind.C;
};

// A `break` in an inner `switch` exits only that one.
const nested = (k: Kind, x: i32): boolean => {
  let j: Kind = Kind.A;
  switch (x) {
    case 1:
      switch (k) {
        case Kind.A:
          j = Kind.B;
          break;
        default:
          j = Kind.C;
          break;
      }
      break;
    default:
      break;
  }
  return j === Kind.A;
};

// A path set by different clauses holds what any of them gave it.
const path = (h: H, x: i32): boolean => {
  switch (x) {
    case 1:
      h.k = Kind.A;
      break;
    default:
      h.k = Kind.C;
  }
  return h.k === Kind.C;
};

// A clause that returns is not an exit of the `switch`.
const returned = (k: Kind, x: i32): boolean => {
  let j: Kind = k;
  switch (x) {
    case 1:
      return true;
    default:
      j = Kind.C;
  }
  return j === Kind.C;
};

// A `break` out of a loop inside a clause stays in the clause.
const looped = (k: Kind, x: i32, c: boolean): boolean => {
  let j: Kind = k;
  switch (x) {
    case 1:
      while (c) {
        j = Kind.A;
        break;
      }
      j = Kind.B;
      break;
    default:
      j = Kind.C;
  }
  return j === Kind.B;
};

export const main = (): void => {
  console.log(early(Kind.A, true));
  console.log(early(Kind.B, false));
  console.log(unmatched(Kind.C));
  console.log(nested(Kind.A, 1));
  console.log(nested(Kind.A, 2));
  console.log(path(new H(Kind.B), 2));
  console.log(returned(Kind.A, 1));
  console.log(looped(Kind.A, 1, true));
};
