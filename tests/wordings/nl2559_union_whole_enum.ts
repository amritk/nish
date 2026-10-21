// NL2559: a variant whose tag is typed with its whole enum.
enum Kind {
  A,
  B,
}

class First {
  readonly kind: Kind = Kind.A;
  x: i32 = 1;
}

class Second {
  readonly kind: Kind.B = Kind.B;
  y: i32 = 2;
}

type Both = First | Second;

export const main = (): void => {
  const b: Both = new Second();
  console.log(b.kind === Kind.B);
};
