// A `Map` reached through the element stores `i32[]` values, and any of them
// could be the array `parallelMapInto` is writing.
import { parallelMapInto } from "nish/threads";

class Doc {
  index: Map<string, i32[]>;

  constructor() {
    this.index = new Map<string, i32[]>();
  }
}

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const docs: Doc[] = [new Doc(), new Doc()];
  docs[0].index.set("a", out);
  parallelMapInto(docs, out, (x: Doc): i32 => {
    const a = x.index.get("a");
    return a === undefined ? 0 : a[0];
  });
  return out[0];
};
