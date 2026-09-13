// A type argument that is a declared class: the `$$` of `Box$$Point` is
// `mangleType`'s struct tag inside the instantiation's own `$` separator, which
// is what keeps the encoding readable in both directions (WP18 §3c).
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

class Box<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
  get(): T {
    return this.value;
  }
}

export const test = (): number => {
  const b = new Box<Point>(new Point(3, 4));
  const p = b.get();
  return p.x + p.y;
};
