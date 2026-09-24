// #173: `implements` names a declaration, not a name. This module's `Shape` is
// not `./lib`'s, so `Circle` does not implement it. It used to be accepted by
// comparing the two names, and `s.name` then read `Circle`'s `area` as a string
// pointer; #173 refused the conversion, and since #193 the private `Shape` in
// `./lib` is refused first, at its declaration (NL3028): one program cannot
// hold two interfaces of one name, exported or not.
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
