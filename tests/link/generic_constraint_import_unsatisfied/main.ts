// WP18 §8 message 1 across a module boundary: the template is `./lib`'s, but
// the request is written here, so the refusal is reported here, against the
// call that implied `T = Point`.
import { areaOf } from "./lib";

class Point {
  area: i32 = 0;
}

export const main = (): i32 => areaOf(new Point());
