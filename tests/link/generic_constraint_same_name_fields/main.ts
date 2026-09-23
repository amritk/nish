// #161 with the fields lined up: this module's `Shape` has exactly `./lib`'s
// field list, which is still not `./lib`'s declaration. Matching by name made
// the two interchangeable and the program compiled; it is refused at the call.
import { areaOf } from "./lib";

interface Shape {
  area: i32;
}

class Square implements Shape {
  area: i32 = 9;
}

export const main = (): i32 => areaOf(new Square());
