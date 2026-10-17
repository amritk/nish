// A union of classes that carry no enum tag is refused at the alias:
// a variant's first field is its tag.
enum Kind {
  Circle,
  Square,
  Tri,
}

class Circle {
  readonly kind: Kind.Circle = Kind.Circle;
  r: i32 = 1;
}

class Square {
  readonly kind: Kind.Square = Kind.Square;
  side: i32 = 2;
}

type Shape = Circle | Square;

const pick = (n: i32): Shape => (n > 0 ? new Circle() : new Square());

class Point {
  x: i32 = 0;
}

class Line {
  length: i32 = 0;
}

type Thing = Point | Line;

export const main = (): void => {
  const t: Thing = new Point();
  console.log(t === null);
};
