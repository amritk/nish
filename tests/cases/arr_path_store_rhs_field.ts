// `g.hs[i].n = (i = 0)`: a field store evaluates its receiver, `g.hs[i]` and
// its check included, before the value. Run by tests/run.js: exit 1 with
// "index out of range: 1000000 >= 2".
class Cell {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
}

class Grid {
  hs: Cell[];
  constructor(hs: Cell[]) {
    this.hs = hs;
  }
}

const poke = (g: Grid, start: i32): i32 => {
  let i = start;
  if (g.hs.length >= 1) {
    g.hs[i].n = (i = 0);
  }
  return i;
};

export const main = (): number => {
  console.log(`${poke(new Grid([new Cell(1), new Cell(2)]), 1000000)}`);
  return 0;
};
