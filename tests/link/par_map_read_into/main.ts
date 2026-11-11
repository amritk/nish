// The body of `parallelMapInto` writes an `i32[]` and reads a `Map<string, i32>`
// and a `Set<i32>` through its element: `get`, `has` and `size` read the
// tables and write nothing, and a table's own arrays are private to it, so the
// only `i32[]` an element could reach is one stored as a key or a value, and
// these store none.
import { parallelMapInto } from "nish/threads";

class Doc {
  id: i32;
  index: Map<string, i32>;
  seen: Set<i32>;

  constructor(id: i32) {
    this.id = id;
    this.index = new Map<string, i32>();
    this.index.set("a", id * 2);
    if (id % 2 === 0) {
      this.index.set("b", 1);
    }
    this.seen = new Set<i32>();
    this.seen.add(id % 3);
  }
}

const score = (x: Doc): i32 => {
  const a = x.index.get("a") ?? 0;
  const b = x.index.has("b") ? 100 : 0;
  const s = x.seen.has(0) ? 1000 : 0;
  return a + b + s + x.index.size + x.seen.size;
};

export const main = (): i32 => {
  const docs: Doc[] = [];
  for (let i = 0; i < 6; i++) {
    docs.push(new Doc(i));
  }
  const out: i32[] = [0, 0, 0, 0, 0, 0];
  parallelMapInto(docs, out, score);
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]} ${out[4]} ${out[5]}`);
  return 0;
};
