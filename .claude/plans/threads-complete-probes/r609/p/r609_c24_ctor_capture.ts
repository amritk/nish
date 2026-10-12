import { parallelMap } from "nish/threads";
class Grid {
  cells: i32[];
  constructor(xs: i32[], k: i32) {
    this.cells = parallelMap(xs, (x) => x * k);
  }
}
export const main = (): i32 => {
  const g = new Grid([1, 2, 3], 4);
  console.log(`${g.cells[2]}`);
  return 0;
};
