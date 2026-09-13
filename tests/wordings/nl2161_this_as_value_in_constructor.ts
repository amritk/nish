// NL2161: `this` escaping the constructor before every field is assigned hands out a half-built struct.
class Point {
  x: i32;
  constructor() {
    use(this);
    this.x = 0;
  }
}

const use = (p: Point): void => {};
