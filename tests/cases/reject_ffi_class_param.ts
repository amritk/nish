// A class instance is a Nish object C cannot read, so a `declare function`
// parameter typed with one is refused by the rule that names what may cross
// (WP40 B1.1: scalars, `CPtr`, a borrowed `string` and a `u8[]` buffer).
class Point {
  x: i32 = 0;
}

declare function plot(p: Point): void;

export function main(): i32 {
  return 0;
}
