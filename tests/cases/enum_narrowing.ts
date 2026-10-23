// An enum variable's tests narrow the members it can hold, as TypeScript's do:
// an assignment widens it again, a loop's test holds only inside the body, and
// once every member is excluded any comparison is allowed, as with `never`.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const reassigned = (k: Kind): i32 => {
  let m = k;
  if (m === Kind.A) {
    m = pick(2);
    return m === Kind.B ? 1 : 0;
  }
  return 0;
};

const looped = (k: Kind): i32 => {
  let m = k;
  let n = 0;
  while (m !== Kind.A) {
    n = n + 1;
    m = n > 3 ? Kind.A : Kind.B;
  }
  return n;
};

const exhausted = (k: Kind): i32 => {
  if (k === Kind.A) {
    return 1;
  }
  if (k === Kind.B) {
    return 2;
  }
  if (k === Kind.C) {
    return 3;
  }
  return k === Kind.A ? 4 : 5;
};

const branches = (k: Kind): i32 => {
  if (k !== Kind.A) {
    return k === Kind.B ? 10 : 20;
  }
  return k === Kind.A ? 30 : 40;
};

const switched = (k: Kind): i32 => {
  switch (k) {
    case Kind.A:
      return 100;
    case Kind.B:
      return k === Kind.B ? 200 : 0;
    default:
      return k === Kind.C ? 300 : 0;
  }
};

export const main = (): void => {
  let i = 0;
  while (i < 3) {
    const k = pick(i);
    console.log(reassigned(k));
    console.log(looped(k));
    console.log(exhausted(k));
    console.log(branches(k));
    console.log(switched(k));
    i = i + 1;
  }
};
