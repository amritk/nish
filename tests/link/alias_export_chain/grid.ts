// Aliases of aliases this module imported: `Table` is `Row[]`, which is
// `i32[][]`, and `Line` is `Row` again under a second name. Each right-hand
// side is resolved by need, through `cells.ts`, whichever module asks first.
import { Cell, Row } from "./cells";

export type Line = Row;
export type Table = Line[];

export const total = (t: Table): Cell => {
  let sum: Cell = 0;
  for (const line of t) {
    for (const c of line) {
      sum = sum + c;
    }
  }
  return sum;
};
