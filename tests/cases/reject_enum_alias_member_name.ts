// Two members with one value are one member type, spelled by the member that
// first asked for it. A comparison that is not refused still asks for its
// member constant, so `Kind.C` names value 1 here, and a narrowing that lists
// every member of `J` names it `J.B` before `J.C` is read. `P.C === k` asks
// for its constant from the left.
enum Kind {
  A = 0,
  B = 1,
  C = 1,
  D = 2,
}

const f = (k: Kind): boolean => {
  const x = k === Kind.C;
  if (k !== Kind.A && k !== Kind.D) {
    return k === Kind.A;
  }
  return x;
};

enum J {
  A = 0,
  B = 1,
  C = 1,
  D = 2,
}

const g = (start: J, other: J, c: boolean): boolean => {
  let k = c ? J.A : J.D;
  if (!c) {
    k = other;
  }
  const y = k === J.C;
  if (k !== J.A && k !== J.D) {
    return k === J.A;
  }
  return y || start === J.A;
};

enum P {
  A = 0,
  B = 1,
  C = 1,
  D = 2,
}

const h = (k: P): boolean => {
  const z = P.C === k;
  if (k !== P.A && k !== P.D) {
    return k === P.A;
  }
  return z;
};

export const main = (): void => {
  console.log(f(Kind.B));
  console.log(g(J.A, J.B, true));
  console.log(h(P.B));
};
