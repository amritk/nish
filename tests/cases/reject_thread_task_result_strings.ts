// A task answers a `string` or a scalar array, not an array of strings: the
// join's flat copy of the array would keep each element's pointer into the
// worker's arena, freed when the task is joined and reused by `churn()`.
import { scope } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

const words = (n: i32): string[] => [`w${n}`, `v${n}`];

export const main = (): i32 => {
  const out: string[][] = [[]];
  {
    using s = scope();
    s.spawn(words, 3, out, 0);
  }
  churn();
  return out[0][1].length;
};
