// R3, an expression-bodied helper answers `g.value.rows[0]`, an array element
// of the guarded object that is itself an array.
import { Mutex, MutexGuard } from "nish/threads";

class Grid {
  rows: i32[][];

  constructor() {
    this.rows = [[1]];
  }
}

const row = (g: MutexGuard<Grid>): i32[] => g.value.rows[0];

export const main = (): i32 => {
  const m = new Mutex<Grid>(new Grid());
  {
    using g = m.lock();
    const r = row(g);
    console.log(r[0]);
  }
  return 0;
};
