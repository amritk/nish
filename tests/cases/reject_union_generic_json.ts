// Typed JSON writes a declared class, so a generic instance over a union, or
// a `Result` of one, is refused as any generic instance is.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

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

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

export const write = (w: JsonWriter): void => {
  jsonEncode(w, new Box<Shape>(pick(1)));
};
