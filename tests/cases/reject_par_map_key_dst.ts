// A `Set` reached through the element stores `Key`s, and a key's `i32[]`
// could be the array `parallelMapInto` is writing.
import { parallelMapInto } from "nish/threads";

class Key {
  cells: i32[];

  constructor(cells: i32[]) {
    this.cells = cells;
  }
}

class Doc {
  keys: Set<Key>;

  constructor() {
    this.keys = new Set<Key>();
  }
}

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const docs: Doc[] = [new Doc(), new Doc()];
  docs[0].keys.add(new Key(out));
  parallelMapInto(docs, out, (x: Doc): i32 => x.keys.size);
  return out[0];
};
