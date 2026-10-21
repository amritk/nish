// An object literal may stand for a class that has no methods, and for an
// interface: under Node either is a plain object, and nothing is called on it
// that a plain object lacks. A class with methods is made by `new` (NL2556).
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

interface Size {
  w: i32;
  h: i32;
}

class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}

export const main = (): i32 => {
  const p: Point = { x: 3, y: 4 };
  const s: Size = { w: 10, h: 20 };
  const c = new Counter(5);
  console.log(p.x + p.y);
  console.log(s.w * s.h);
  console.log(c.get());
  return 0;
};
