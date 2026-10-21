// #740: a union variant whose constructor is empty still stores its tag, so a
// `switch` on `kind` takes the variant's arm (60, as under Node).
enum Kind {
  A,
  B,
}

class A {
  readonly kind: Kind.A = Kind.A;
  a: i32 = 1;

  constructor() {}
}

class B {
  readonly kind: Kind.B = Kind.B;
  b: i32 = 2;
}

type U = A | B;

const pick = (n: i32): U => {
  if (n === 0) {
    return new A();
  }
  return new B();
};

const score = (u: U): i32 => {
  switch (u.kind) {
    case Kind.A:
      return 10;
    case Kind.B:
      return 20;
    default:
      return 99;
  }
};

export const main = (): i32 => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += score(pick(i % 2));
  }
  console.log(s);
  return 0;
};
