// #161's positive: the constraint may still be a declaration of the module that
// asks, as long as the template's module imports that same declaration back
// (G6's shape (f)). `Circle implements Shape` names the `Shape` that `./lib`'s
// `areaOf` is bounded by, so the request is met.
import { areaOf } from "./lib";

export interface Shape {
  area: i32;
}

class Circle implements Shape {
  area: i32;
  radius: i32;

  constructor(radius: i32) {
    this.area = 3 * radius * radius;
    this.radius = radius;
  }
}

export const main = (): i32 => {
  const own: Shape = { area: 5 };
  console.log(`${areaOf(new Circle(2))}`);
  console.log(`${areaOf(own)}`);
  return 0;
};
