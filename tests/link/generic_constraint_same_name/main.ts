// #161: a constraint is a declaration, not a name. This module's `Shape` is not
// `./lib`'s, so `Circle implements Shape` says nothing about `areaOf`'s bound.
// That was refused at the call; since #193 the second `Shape` is refused first,
// at its declaration (NL3028), because two same-named interfaces in one program
// would be one type, and the call is never checked.
import { areaOf } from "./lib";

interface Shape {
  radius: i32;
}

class Circle implements Shape {
  radius: i32 = 3;
}

export const main = (): i32 => areaOf(new Circle());
