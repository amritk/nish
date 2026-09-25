// The negatives of the callee scope: callees that store what they allocate
// where the caller can reach it. `Cache.run` and `outer` both return an `i32`
// and allocate nothing themselves, but `remember` puts a fresh `Cell` into
// `this.last` and `fill` puts one into a field of its parameter. A release on
// the way out of either would free the cell `main` reads next, so neither gets
// a scope: `Cache` and `Box` each have a field a pointer fits in, and the
// escape analysis sees both stores (`allocEscapes`).
class Cell {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

class Cache {
  last: Cell | null = null;

  remember(n: i32): void {
    this.last = new Cell(n);
  }

  run(n: i32): i32 {
    this.remember(n);
    return n;
  }
}

class Box {
  cell: Cell | null = null;
}

const fill = (box: Box, n: i32): void => {
  box.cell = new Cell(n);
};

const outer = (box: Box, n: i32): i32 => {
  fill(box, n);
  return n;
};

export const main = (): number => {
  const cache = new Cache();
  cache.run(41);
  const box = new Box();
  outer(box, 42);
  // Allocate over whatever a wrong release would have handed back.
  const junk: Cell[] = [];
  for (let i = 0; i < 64; i++) {
    junk.push(new Cell(-1));
  }
  const last = cache.last;
  const cell = box.cell;
  if (last !== null && cell !== null) {
    console.log(last.v);
    console.log(cell.v);
  }
  return junk.length - 64;
};
