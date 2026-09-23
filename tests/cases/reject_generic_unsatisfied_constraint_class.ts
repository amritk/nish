// WP18 §8 message 1, the struct half, after `new`: `Point` has an `area`, but
// it does not `implements Shape`, and satisfying a constraint is a declaration
// rather than a coincidence of field names.
interface Shape {
  area: i32;
}

class Point {
  area: i32 = 0;
}

class Holder<T extends Shape> {
  item: T;

  constructor(item: T) {
    this.item = item;
  }
}

export const test = (): number => {
  const held = new Holder<Point>(new Point());
  return 0;
};
