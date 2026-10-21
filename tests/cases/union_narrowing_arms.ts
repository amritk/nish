// What an `if` whose one arm falls through leaves, a test against an enum
// variable of several members, a side of `||` that excluded every variant,
// a ternary of members held by the local it initialises, what an `if`, a loop
// and a `switch` that store a member leave, and a test inside a block.
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

// Past an `else if` chain whose branches all return, `s` is the variant
// neither test named.
const chain = (s: Shape): i32 => {
  if (s.kind === Kind.Circle) {
    return 1;
  } else if (s.kind === Kind.Square) {
    return 2;
  }
  return s.base;
};

// `s.kind === k`, with `k` one of two members, narrows `s` to their variants.
const side = (s: Shape, k: Kind): i32 => {
  if (k === Kind.Tri) {
    return 0;
  }
  if (s.kind === k) {
    if (s.kind === Kind.Circle) {
      return s.r;
    }
    return s.side;
  }
  return -1;
};

// With `s` already a Tri, the left of `||` leaves it nothing, and the join is
// the Tri the right side reads.
const join = (s: Shape): i32 => {
  if (s.kind !== Kind.Tri) {
    return 0;
  }
  if (s.kind !== Kind.Tri || s.base > 1) {
    return s.base;
  }
  return -1;
};

// A ternary of two members: `k` holds one of them, and a test sorts them.
const held = (n: i32): i32 => {
  let k: Kind = n > 1 ? Kind.Circle : Kind.Square;
  let total = 0;
  if (k === Kind.Circle) {
    total = total + 10;
  } else {
    total = total + 20;
  }
  k = Kind.Tri;
  if (k === Kind.Tri) {
    total = total + 1;
  }
  return total;
};

// `j === k`, with `k` one of two members, leaves `j` one of them too.
const same = (j: Kind, n: i32): i32 => {
  const k: Kind = n > 1 ? Kind.Circle : Kind.Square;
  if (j === k) {
    return j === Kind.Circle ? 1 : 2;
  }
  return 0;
};

// After an `if`, a loop and a `switch` that store `Kind.Square`, `k` is a
// Circle or a Square, and a test tells them apart.
const stored = (n: i32): i32 => {
  let k: Kind = Kind.Circle;
  let total = 0;
  if (n > 1) {
    k = Kind.Square;
  }
  total = total + (k === Kind.Square ? 1 : 0);
  k = Kind.Circle;
  let i = 0;
  while (i < n) {
    if (k === Kind.Square) {
      total = total + 10;
    }
    k = Kind.Square;
    i = i + 1;
  }
  k = Kind.Circle;
  switch (n) {
    case 3:
      k = Kind.Square;
      break;
    default:
      break;
  }
  return total + (k === Kind.Circle ? 100 : 200);
};

// A block's early return narrows `s` for what follows the block.
const inBlock = (s: Shape): i32 => {
  {
    if (s.kind !== Kind.Circle) {
      return 0;
    }
  }
  return s.r;
};

export const main = (): void => {
  let i = 0;
  let sum = 0;
  while (i < 6) {
    const s = pick(i);
    sum = sum + chain(s) * 1000 + side(s, i % 2 === 0 ? Kind.Circle : Kind.Square) * 100 + join(s) * 10;
    console.log(sum);
    i = i + 1;
  }
  console.log(held(0));
  console.log(held(2));
  console.log(same(Kind.Circle, 2));
  console.log(same(Kind.Square, 0));
  console.log(same(Kind.Tri, 0));
  console.log(stored(0));
  console.log(stored(3));
  console.log(inBlock(pick(6)));
  console.log(inBlock(pick(7)));
};
