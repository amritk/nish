// A `Map`'s value may be a union, but nish/map's `getOrInsert` is a generic
// function, and a union is not a generic's type argument (NL2533).
import { getOrInsert } from "nish/map";

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

export const main = (): void => {
  const m = new Map<string, Shape>();
  console.log(getOrInsert(m, "a", new Circle()).kind);
  console.log(m.size);
};
