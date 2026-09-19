// The whole-program half of WP18: a generic declared in `./lib` and
// instantiated here. Every `identity$*`, `firstOf$*` and `Box$*.*` symbol is
// defined once, in `lib.ll`, and `declare`d here — which the harness checks
// attribute for attribute, and which is what makes the two sides one function
// rather than two copies that happen to agree.
import { Box, firstOf, identity } from "./lib";

class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export const main = (): i32 => {
  console.log(identity("cross-module"));
  const numbers = new Box<i32>(7);
  console.log(`${identity(numbers.get())}`);
  // The type argument is a class this module declares and `./lib` has never
  // heard of, so `lib.ll` is where `%struct.Point` and `@Box$Point.get` end up.
  const here = new Box<Point>(new Point(4, 6));
  console.log(`${here.get().x + here.get().y}`);
  return firstOf([identity(3), 99]) + here.get().x;
};
