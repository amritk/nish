// Precedence and associativity, where a recursive-descent parser goes wrong
// quietly. Every line below has exactly one correct tree and the oracle knows
// which it is.
function f(a: number, b: number, c: number, d: number): number {
  let x = a + b * c - d / a % b;
  x = a << b >> c >>> d;
  x = a & b | c ^ d;
  x = a + b < c - d ? a * b : c || d ? a : b;
  x = -a + +b - ~c;
  x = a === b !== (c < d);
  x = a && b || c && d;
  x += a -= b *= c /= d %= a;
  x = a++ + ++b - c-- - --d;
  return x;
}

function g(p: Point, xs: number[][]): number {
  return p.x + xs[0][1] + f(1, 2, 3, 4) + new Point(1, 2).x + (p.x + p.y) * 2;
}

function chains(p: Point): string {
  return `${p.x}${p.y}` + `a${p.x + 1}b${`${p.y}`}c`;
}

class Point {
  x: number = 0;
  y: number = 0;
}
