// WP34 N12: `availableParallelism` and `totalMemory` read facts about the host
// and write nothing, so a `scope()` task and a parallel body may call them.
import { parallelMapInto, scope } from "nish/threads";

const cores = (n: i32): i32 => (availableParallelism() >= 1 ? n : -1);

const memory = (n: i32): i32 => (totalMemory() > toI64(0) ? n : -1);

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(cores, 1, out, 0);
    s.spawn(memory, 2, out, 1);
  }
  const par: i32[] = [0, 0];
  parallelMapInto([3, 4], par, cores);
  console.log(`${out[0]} ${out[1]} ${par[0]} ${par[1]}`);
  return 0;
};
