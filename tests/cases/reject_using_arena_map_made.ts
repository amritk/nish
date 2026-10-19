// A `using a = arena()` block may not store into a field of an object older than
// the block what a helper answers from a map: the helper's result is the map's
// array, allocated in the block and freed by its release.
import { parallelMap } from "nish/threads";

class Holder {
  ws: string[];

  constructor() {
    this.ws = [];
  }
}

const made = (xs: i32[]): string[] => parallelMap(xs, (x) => `w${x}`);

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const h = new Holder();
  {
    using a = arena();
    h.ws = made(xs);
  }
  console.log(h.ws[2]);
  return 0;
};
