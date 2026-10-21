// The true side of `a || b`, and the false side of `a && b`, narrow a
// union variable to the variants either side leaves it, and an enum variable
// to the members either side leaves it.
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

// Circle or Square: a second test of the tag narrows to one of the two.
const size = (s: Shape): i32 => {
  if (s.kind === Kind.Circle || s.kind === Kind.Square) {
    return s.kind === Kind.Circle ? s.r : s.side;
  }
  return s.base;
};

// The false side of `&&`: past the return, `s` is a Square or a Tri.
const edge = (s: Shape): i32 => {
  if (s.kind !== Kind.Square && s.kind !== Kind.Tri) {
    return 0;
  }
  return s.kind === Kind.Square ? s.side * 4 : s.base * 3;
};

enum Level {
  Low,
  Mid,
  High,
  Max,
}

const level = (n: i32): Level => (n === 0 ? Level.Low : n === 1 ? Level.Mid : n === 2 ? Level.High : Level.Max);

// Three arms leave three members; the fourth is the only one left after.
const rank = (l: Level): i32 => {
  if (l === Level.Low || l === Level.Mid || l === Level.High) {
    return l === Level.Low ? 1 : l === Level.Mid ? 2 : 3;
  }
  return 4;
};

// Mixed `===` and `!==`: the true side leaves `l` anything but `Mid`.
const lift = (l: Level): i32 => (l === Level.Low || l !== Level.Mid ? (l === Level.Max ? 9 : 5) : 0);

// A test reads through an assignment: `(t = pick(n)).kind` tests the `t` just written, in a
// `switch` and in an `if` alike.
const fresh = (n: i32): i32 => {
  let t: Shape = pick(n);
  switch ((t = pick(n + 1)).kind) {
    case Kind.Circle:
      return t.r;
    default:
      break;
  }
  if ((t = pick(n + 3)).kind !== Kind.Square) {
    return 0;
  }
  return t.side;
};

export const main = (): void => {
  let total = 0;
  let i = 0;
  while (i < 6) {
    const s = pick(i + 2);
    console.log(size(s) * 100 + edge(s));
    total = total + size(s) + edge(s);
    i = i + 1;
  }
  let n = 0;
  while (n < 4) {
    console.log(rank(level(n)) * 10 + lift(level(n)));
    n = n + 1;
  }
  console.log(total + fresh(0) * 1000 + fresh(1) * 10000 + fresh(2) * 100000);
};
