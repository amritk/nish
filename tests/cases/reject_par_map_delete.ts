// A `delete` on a `Map` reached through the element writes its table, which
// another element may share.
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
    x.index.delete("a");
    return x.index.size;
  });
  return ys[0];
};
