// A union variant whose tag comes from a field initializer and whose explicit
// constructor never writes `this`: the prologue's tag store is a write through
// `this`, so the constructor's `this` is not `readonly` and -O keeps the store
// the covered `switch` reads (#740).
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

const f = (u: U): i32 => {
  switch (u.kind) {
    case Kind.A:
      return 10;
    case Kind.B:
      return 20;
  }
};

export const main = (): i32 => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += f(pick(i % 2));
  }
  console.log(s);
  return 0;
};
