// #161: a constraint is a declaration, not a name. This module's `Shape` is not
// `./lib`'s, so `Circle implements Shape` says nothing about `areaOf`'s bound,
// and the request is refused here, at the call, rather than inside the template
// as an unknown field `area` on `Circle`.
import { areaOf } from "./lib";

interface Shape {
  radius: i32;
}

class Circle implements Shape {
  radius: i32 = 3;
}

export const main = (): i32 => areaOf(new Circle());
