// A generic instance over a union crosses no C boundary: its union field has
// no C spelling, and the message names the instance as it is written
// (`Slot<Circle | Square>`), not by its mangled name.
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

export class Slot<T> {
  value: T | null = null;
}

export const make = (n: i32): Slot<Shape> => {
  const s = new Slot<Shape>();
  s.value = pick(n);
  return s;
};
