// The parent may not walk a `Set` between the first `spawn` and the join even
// when no task can reach it: the rule asks whether a task could reach memory
// of the table's type, not whether this task does. Here the task takes only an
// `i32[]`, so the walk is safe, and it is still refused. The rule is
// conservative on purpose: proving that no task reaches one particular table
// would mean following every pointer a task is handed, and a refusal costs
// only moving the walk before the first `spawn` or after the block.
import { scope } from "nish/threads";

const sum = (xs: i32[]): i32 => {
  let t = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const seen = new Set<i32>();
  seen.add(7);
  const xs: i32[] = [1, 2, 3];
  const out: i32[] = [0];
  let t = 0;
  {
    using s = scope();
    s.spawn(sum, xs, out, 0);
    for (const k of seen) {
      t = t + k;
    }
  }
  console.log(`${out[0]} ${t}`);
  return 0;
};
