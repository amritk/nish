// Functions, classes, interfaces, module constants and type aliases share one
// declaration namespace, so a name may be taken only once.
type Point = i32;

class Point {
  x: i32 = 0;
}

export function test(): number {
  return 0;
}
