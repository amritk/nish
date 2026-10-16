// Only an enum's member may be named with a dot in a type: a class has no
// member types, and neither does anything else a name can stand for.
class Point {
  x: i32 = 0;
}

const origin = (p: Point.x): i32 => p;

export const test = (): number => origin(0);
