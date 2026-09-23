// WP18 §8 message 1, in an annotation: the request is the signature, which is
// resolved in pass 1 — above `class Point`, so before its `implements` clause
// has been read — and the check waits for pass 1b rather than guessing.
interface Shape {
  area: i32;
}

class Holder<T extends Shape> {
  item: T;

  constructor(item: T) {
    this.item = item;
  }
}

const unwrap = (held: Holder<Point>): i32 => 0;

class Point {
  area: i32 = 0;
}

export const test = (): number => 0;
