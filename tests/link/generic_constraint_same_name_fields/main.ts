// #161 with the fields lined up: this module's `Shape` has exactly `./lib`'s
// field list, which is still not `./lib`'s declaration. Matching by name made
// the two interchangeable and the program compiled. It was then refused at the
// call; since #193 the second `Shape` is refused at its declaration (NL3028),
// identical fields or not.
import { areaOf } from "./lib";

interface Shape {
  area: i32;
}

class Square implements Shape {
  area: i32 = 9;
}

export const main = (): i32 => areaOf(new Square());
