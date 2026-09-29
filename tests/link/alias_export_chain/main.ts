// `main.ts` names `Table` and `Line` from `grid.ts` and never imports
// `cells.ts`: a chain of aliases across three modules resolves to `i32[][]`,
// and a `Line` is a `Row` is an `i32[]`.
import { Line, Table, total } from "./grid";

const row = (n: i32): Line => {
  const out: Line = [];
  for (let i: i32 = 1; i <= n; i++) {
    out.push(i);
  }
  return out;
};

export const main = (): number => {
  const t: Table = [row(1), row(2), row(3)];
  const flat: i32[] = row(4);
  t.push(flat);
  console.log(`${t.length} ${total(t)}`);
  return total(t) === 20 ? 0 : 1;
};
