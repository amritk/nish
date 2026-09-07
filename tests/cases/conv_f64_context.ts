// A non-integer literal takes its type from the context that demands it. The
// variable and return cases already worked; an array element, a field
// assignment and a constructor argument did not, so `const xs: f64[] = [0.5]`
// and `new Point(1.5, 2.25)` were rejected in the default i32 number mode.
class Config {
  ratio: f64;
  weights: f64[];

  constructor() {
    this.ratio = 0.25;
    this.weights = [0.5, 1.5, 2.5];
  }
}

class Point {
  x: f64;
  y: f64;

  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }
}

export function main(): number {
  const xs: f64[] = [0.5, 1.5];
  const c = new Config();
  console.log(xs[0] + c.ratio + c.weights[2]);
  // A constructor parameter is an annotation like any other.
  console.log(new Point(1.5, 2.25).x);
  return 0;
}
