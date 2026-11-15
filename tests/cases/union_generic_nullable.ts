// A nullable union as a type argument: `Result<Shape | null, E>` carries
// `Ok(null)` and `Ok(variant)`, and `Box<Shape | null>` holds either; the
// non-null arm of `box?.value ?? new Circle()` is the variant the box held.
enum Kind {
  Circle,
  Square,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 2;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 3;
}

type Shape = Circle | Square;

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

const area = (s: Shape): i32 => (s.kind === Kind.Circle ? 3 * s.r * s.r : s.side * s.side);

const find = (n: i32): Result<Shape | null, string> => {
  if (n < 0) {
    return Err("negative");
  }
  if (n === 0) {
    return Ok(null);
  }
  return Ok(new Square());
};

const describe = (r: Result<Shape | null, string>): string => {
  if (!r.ok) {
    return r.error;
  }
  const s = r.value;
  return s === null ? "none" : `area ${area(s)}`;
};

const open = (box: Box<Shape | null> | null): i32 => area(box?.value ?? new Circle());

export const main = (): void => {
  console.log(describe(find(-1)));
  console.log(describe(find(0)));
  console.log(describe(find(1)));
  console.log(open(null));
  console.log(open(new Box<Shape | null>(null)));
  console.log(open(new Box<Shape | null>(new Square())));
};
