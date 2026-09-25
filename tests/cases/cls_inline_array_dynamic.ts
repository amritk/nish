// Negative: the length is a parameter, not a literal, so no slot size is known
// and the field keeps the pointer layout.
class Grid {
  cells: i32[];

  constructor(n: i32) {
    this.cells = new Array<i32>(n);
  }
}

export const main = (): number => {
  const g = new Grid(5);
  g.cells[4] = 9;
  console.log(`${g.cells.length} ${g.cells[4]}`);
  return 0;
};
