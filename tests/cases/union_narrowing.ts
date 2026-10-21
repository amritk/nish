// A discriminated union narrowed by a test of its tag, in every form: `if`
// and `else`, a ternary, `&&`, `||`, an early return, `!==`, the operands
// reversed, a `switch`, and composed with a null test. A narrowed variable reads
// its variant's fields and calls its methods; an assignment drops the narrowing.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32;
  constructor(r: i32) {
    this.r = r;
  }

  diameter(): i32 {
    return this.r * 2;
  }
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32;
  constructor(side: i32) {
    this.side = side;
  }
}

interface Tri {
  readonly kind: Kind.Tri;
  base: i32;
}

type Shape = Circle | Square | Tri;

const pick = (n: i32): Shape => {
  if (n % 3 === 0) {
    return new Circle(n);
  }
  if (n % 3 === 1) {
    return new Square(n);
  }
  const t: Tri = { kind: Kind.Tri, base: n };
  return t;
};

const viaIf = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return s.r;
  } else {
    if (s.kind === Kind.Square) {
      return s.side * 10;
    }
    return s.base * 100;
  }
};

const viaTernary = (s: Shape): i32 =>
  s.kind === Kind.Circle ? s.r : s.kind === Kind.Square ? s.side : s.base;

const viaAnd = (s: Shape): boolean => s.kind === Kind.Circle && s.r > 3;

const viaOr = (s: Shape): boolean => s.kind !== Kind.Square || s.side > 3;

const viaEarly = (s: Shape): i32 => {
  if (s.kind !== Kind.Tri) {
    return 0;
  }
  return s.base;
};

const viaReversed = (s: Shape): i32 => {
  if (Kind.Square === s.kind) {
    return s.side;
  }
  return -1;
};

const viaNull = (s: Shape | null): i32 => {
  if (s !== null && s.kind === Kind.Circle) {
    return s.r;
  }
  if (s === null) {
    return -2;
  }
  if (s.kind === Kind.Tri) {
    return s.base;
  }
  return -3;
};

const viaLocal = (n: i32): i32 => {
  const s: Shape = pick(n);
  if (s.kind === Kind.Square) {
    return s.side;
  }
  return 7;
};

const viaSwitch = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return s.r;
    case Kind.Square:
      return s.side;
    default:
      return s.base;
  }
};

const viaElse = (s: Shape): i32 => {
  if (s.kind !== Kind.Circle) {
    return 0;
  } else {
    return s.diameter();
  }
};

const viaReassign = (n: i32): i32 => {
  let s: Shape = pick(n);
  if (s.kind === Kind.Circle) {
    s = pick(n + 1);
    if (s.kind === Kind.Square) {
      return s.side;
    }
    return -1;
  }
  return -2;
};

const viaTag = (s: Shape): boolean => {
  const k: Kind = s.kind;
  return k === Kind.Circle;
};

export const main = (): void => {
  let i = 0;
  while (i < 6) {
    const s = pick(i);
    console.log(`${viaIf(s)} ${viaTernary(s)} ${viaAnd(s)} ${viaOr(s)} ${viaEarly(s)} ${viaReversed(s)} ${viaNull(s)} ${viaLocal(i)} ${viaSwitch(s)} ${viaElse(s)} ${viaReassign(i)} ${viaTag(s)}`);
    i = i + 1;
  }
  console.log(viaNull(null));
};
