// References cross a module boundary both ways: `main.ts` stores functions
// `ops.ts` declares, and `ops.ts` calls a function `main.ts` declares.
import { apply, inc, Op, pick, triple } from "./ops";

const negate = (x: i32): i32 => -x;

class Stage {
  op: Op;

  constructor() {
    this.op = inc;
  }
}

export const main = (): number => {
  const ops: Op[] = [inc, triple, negate];
  let total = 0;
  for (const op of ops) {
    total = total + apply(op, 5);
  }
  const s = new Stage();
  s.op = pick(true);
  const same = pick(false) === inc;
  console.log(`${total} ${s.op(2)} ${apply(negate, 7)} ${same}`);
  return total === 16 && same ? 0 : 1;
};
