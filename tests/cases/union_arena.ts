// A union-typed store that outlives its function's arena. Each writer below
// makes a string, so its body runs under an arena mark, and stores a variant
// that it allocates into a caller's field or array as a `Shape`: through a
// `new` checked into the union, a call that returns the union, a conditional
// of locals, and an array literal. Each variant escapes to the heap, and
// `churn()` reuses the released arena before `main` reads every tag back.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 3;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 4;
}

type Shape = Circle | Square;

class Holder {
  s: Shape;
  all: Shape[];
  constructor(s: Shape) {
    this.s = s;
    this.all = [];
  }
}

const pick = (round: boolean): Shape => (round ? new Circle() : new Square());

const viaNew = (h: Holder, n: i32): i32 => {
  const label = `n=${n}`;
  h.s = n > 0 ? new Circle() : new Square();
  return label.length;
};

const viaCall = (h: Holder, n: i32): i32 => {
  const label = `n=${n}`;
  h.s = pick(n > 0);
  return label.length;
};

const viaLocals = (h: Holder, n: i32): i32 => {
  const label = `n=${n}`;
  const c = new Circle();
  const q = new Square();
  h.s = n > 0 ? c : q;
  return label.length;
};

const viaArray = (h: Holder, n: i32): i32 => {
  const label = `n=${n}`;
  const c = new Circle();
  const q = new Square();
  h.all = [c, q];
  return label.length;
};

const viaPush = (xs: Shape[], n: i32): i32 => {
  const label = `n=${n}`;
  xs.push(new Circle());
  return label.length;
};

const churn = (): i32 => {
  let t = 0;
  let i = 0;
  while (i < 100) {
    const s = new Square();
    s.side = 7;
    const p: Square[] = [s];
    t = t + p[0].side;
    i++;
  }
  return t;
};

export const main = (): number => {
  const h1 = new Holder(new Square());
  const h2 = new Holder(new Square());
  const h3 = new Holder(new Square());
  const h4 = new Holder(new Square());
  const xs: Shape[] = [];
  console.log(`${viaNew(h1, 5)} ${viaCall(h2, 5)} ${viaLocals(h3, 5)} ${viaArray(h4, 5)} ${viaPush(xs, 5)}`);
  const big: string[] = [];
  let i = 0;
  while (i < 100) {
    big.push(`garbage ${i} ${i * 7} ${i * 13}`);
    i++;
  }
  console.log(`${churn()} ${big.length}`);
  console.log(`${h1.s.kind === Kind.Circle} ${h2.s.kind === Kind.Circle} ${h3.s.kind === Kind.Circle}`);
  console.log(`${h4.all[0].kind === Kind.Circle} ${h4.all[1].kind === Kind.Square} ${xs[0].kind === Kind.Circle}`);
  return 0;
};
