// A non-integer literal takes its type from the context that demands it. The
// variable and return cases already worked; an array element and a field
// assignment did not, so `const xs: f64[] = [0.5]` was rejected in i32 mode.
class Config {
  ratio: f64;
  weights: f64[];

  constructor() {
    this.ratio = 0.25;
    this.weights = [0.5, 1.5, 2.5];
  }
}

export function main(): number {
  const xs: f64[] = [0.5, 1.5];
  const c = new Config();
  console.log(xs[0] + c.ratio + c.weights[2]);
  return 0;
}
