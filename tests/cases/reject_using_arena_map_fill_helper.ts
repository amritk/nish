// The same as `reject_using_arena_map_into`, through a helper: the call hands
// `out`, older than the block, to a function that fills it with a map's
// strings, so the block is refused at the call.
import { parallelMapInto } from "nish/threads";

const fillOuter = (xs: i32[], out: string[], k: i32): i32 => {
  parallelMapInto(xs, out, (x) => `w${x + k}`);
  return out.length;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const out: string[] = ["", "", ""];
  let n = 0;
  {
    using a = arena();
    n = fillOuter(xs, out, 1);
  }
  console.log(`${n} ${out[2]}`);
  return 0;
};
