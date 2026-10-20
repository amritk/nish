// A scope declared by the same `using` as an `arena()`, ahead of it, is
// disposed after the arena: it joins once the block has released. A task filed
// on it may not be handed an array the block allocated, whatever declarator
// order the statement writes (`using a = arena(), s = scope()` joins first and
// is accepted).
import { scope } from "nish/threads";

const size = (ys: i32[]): i32 => ys.length;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope(),
      a = arena();
    const ys = new Array<i32>(8);
    s.spawn(size, ys, out, 0);
  }
  console.log(`${out[0]}`);
  return 0;
};
