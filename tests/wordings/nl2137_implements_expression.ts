// NL2137: `implements` takes a name, not an expression, and says so before resolving anything.
export const main = (): i32 => 0;

class Point implements a.B {
  x: i32 = 0;
}
