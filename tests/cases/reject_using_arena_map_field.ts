// A `using a = arena()` block may not store a map's array into a field of an
// object older than the block: the block's release frees the array, and the
// object is read after it.
import { parallelMap } from "nish/threads";

class Holder {
  ws: string[];

  constructor() {
    this.ws = [];
  }
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const h = new Holder();
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    h.ws = ws;
  }
  console.log(h.ws[2]);
  return 0;
};
