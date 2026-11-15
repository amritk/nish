// A union does not meet a constraint: `T extends HasKind` asks for a class
// that declares `implements HasKind`, and a union is not one.
enum Kind {
  Circle,
  Square,
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

interface HasKind {
  readonly kind: Kind;
}

const kindOf = <T extends HasKind>(x: T): Kind => x.kind;

export const main = (): void => {
  console.log(kindOf(pick(1)) === Kind.Circle ? "circle" : "square");
};
