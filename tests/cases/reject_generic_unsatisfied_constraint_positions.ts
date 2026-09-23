// WP18 §8 message 1 wherever a type argument can be written: a class field, an
// array element, a `Result` arm, inside another instantiation, and the target
// of an `implements`. Each is its own request, so each is refused where its
// type argument was written, and the checker carries on to the next.
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

interface Holder2<T extends Shape> {
  item: T;
}

class Keeper {
  held: Holder<Point> | null = null;
}

const firstOf = (hs: Holder<Point>[]): i32 => 0;

const found = (r: Result<Holder<Point>, string>): i32 => 0;

const nested = (h: Holder<Holder<Point>>): i32 => 0;

class Wrapped implements Holder2<Point> {
  item: Point;

  constructor(item: Point) {
    this.item = item;
  }
}

export const test = (): number => 0;
