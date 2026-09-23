// #173: `implements` names a declaration, not a name. This module's `Shape` is
// not `./lib`'s, so `Circle` does not implement it and the implicit class to
// interface conversion is refused. It used to be accepted by comparing the two
// names, and `s.name` then read `Circle`'s `area` as a string pointer.
import { Circle } from "./lib";

interface Shape {
  radius: f64;
  name: string;
}

export const main = (): i32 => {
  const s: Shape = new Circle();
  console.log(s.name);
  return 0;
};
