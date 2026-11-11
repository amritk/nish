// Walking a `Map` reached through the element counts the walk on the table,
// a store another element's walk may race with.
import { parallelMap } from "nish/threads";

class Doc {
  index: Map<string, i32>;

  constructor() {
    this.index = new Map<string, i32>();
  }
}

export const main = (): i32 => {
  const docs: Doc[] = [new Doc(), new Doc()];
  const ys = parallelMap(docs, (x: Doc): i32 => {
    let t = 0;
    for (const v of x.index.values()) {
      t += v;
    }
    return t;
  });
  return ys[0];
};
