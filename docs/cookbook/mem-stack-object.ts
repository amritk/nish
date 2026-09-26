interface Pair {
  first: number;
  second: number;
}

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

// An object literal that is only read: the function's own memory, so `readnone`.
const swapped = (a: number, b: number): number => {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
};

// A constructed object that never escapes: an alloca, the constructor writes through it.
const nearest = (x: number): number => {
  const p = new Point(x, 4);
  return p.manhattan();
};
