// A `Secret` made before a complete `switch` on a union's tag, wiped in every
// clause, which then `break`s: the case no label names cannot reach the end of
// the `switch` holding the key unwiped, so the `return` after it is accepted.
// With a plain enum the same `switch` is refused
// (`reject_union_switch_secret_enum`).
import { Secret, expose, secret, wipe } from "nish:secret";

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

const key = (): u8[] => [3, 1, 4, 1, 5];

const sum = (k: u8[]): i32 => {
  let total: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    total = total + toI32(k[i]);
  }
  return total;
};

const weigh = (s: Shape): i32 => {
  const k: Secret<u8[]> = secret(key());
  let out: i32 = 0;
  switch (s.kind) {
    case Kind.Circle:
      out = expose(k, sum) * s.r;
      wipe(k);
      break;
    case Kind.Square:
      out = expose(k, sum) + s.side;
      wipe(k);
      break;
  }
  return out;
};

export const main = (): i32 => {
  console.log(weigh(new Circle(2)));
  console.log(weigh(new Square(5)));
  return 0;
};
