// Type syntax, including the one place the lexer and the parser disagree on
// purpose: `>>` is one token to the lexer, and two closers here.
function nested(a: Array<Array<number>>, b: Array<Array<Array<i64>>>): Array<number> {
  return a[0];
}

function unions(p: Point | null, q: string | null, r: number[][]): Point | null {
  return p;
}

function arrays(x: i32[], y: Array<f64>, z: Int32Array): void {}

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
