// A union is either payload of a `Result`: `Ok(new Circle(n))` and
// `Err(new Square(n))` enter it as a return or an argument does, and a
// narrowed `r.value` / `r.error` is the union, which a switch on its tag
// narrows again.
enum Kind {
  Circle,
  Square,
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

type Shape = Circle | Square;

const area = (s: Shape): i32 => {
  switch (s.kind) {
    case Kind.Circle:
      return 3 * s.r * s.r;
    case Kind.Square:
      return s.side * s.side;
  }
};

const pick = (n: i32): Shape => (n > 0 ? new Circle(n) : new Square(-n));

const measure = (n: i32): Result<Shape, string> => {
  if (n === 0) {
    return Err("zero");
  }
  return Ok(n > 0 ? new Circle(n) : new Square(-n));
};

const check = (n: i32): Result<i32, Shape> => (n > 0 ? Ok(n) : Err(new Square(-n)));

const pass = (n: i32): Result<Shape, Shape> => (n > 0 ? Ok(new Circle(n)) : Err(pick(n)));

export const main = (): void => {
  const r = measure(3);
  if (r.ok) {
    const shape = r.value;
    switch (shape.kind) {
      case Kind.Circle:
        console.log(shape.r);
        break;
      case Kind.Square:
        console.log(shape.side);
        break;
    }
  }
  const z = measure(0);
  if (!z.ok) {
    console.log(z.error);
  }
  const e = check(-6);
  if (!e.ok) {
    console.log(area(e.error));
  }
  const p = pass(-2);
  console.log(p.ok ? area(p.value) : -area(p.error));
};
