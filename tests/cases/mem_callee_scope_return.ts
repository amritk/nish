// A negative of the callee scope: `summary` gets all its memory from callees,
// and the list `count` builds is garbage once its length is read, but
// `summary` returns a pointer. What it returns was allocated during the call,
// so a release on the way out would free it, and there is no scope.
class Cell {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

class Pair {
  a: i32;
  b: i32;

  constructor(a: i32, b: i32) {
    this.a = a;
    this.b = b;
  }
}

const count = (n: i32): Cell[] => {
  const xs: Cell[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(new Cell(i));
  }
  return xs;
};

const summary = (n: i32): Pair => new Pair(count(n).length, n);

export const main = (): number => {
  const p = summary(7);
  const junk = count(64);
  console.log(p.a);
  console.log(p.b);
  return junk.length - 64;
};
