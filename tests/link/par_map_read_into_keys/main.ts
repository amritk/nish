// The body of `parallelMapInto` writes a `string[]` and reads a
// `Map<string, i32>` and a `Set<string>` through its element, whose keys are
// strings: a table's own array of keys is private to it, so it cannot be the
// array being written, and the body reads it through `get` and `has` only.
import { parallelMapInto } from "nish/threads";

class Doc {
  name: string;
  counts: Map<string, i32>;
  tags: Set<string>;

  constructor(name: string, n: i32) {
    this.name = name;
    this.counts = new Map<string, i32>();
    this.counts.set(name, n);
    this.tags = new Set<string>();
    if (n > 1) {
      this.tags.add("big");
    }
  }
}

const label = (x: Doc): string => {
  const n = x.counts.get(x.name) ?? 0;
  const big = x.tags.has("big") ? "+" : "-";
  return `${x.name}${n}${big}${x.counts.size}`;
};

export const main = (): i32 => {
  const docs: Doc[] = [new Doc("a", 1), new Doc("b", 2), new Doc("c", 3)];
  const out: string[] = ["", "", ""];
  parallelMapInto(docs, out, label);
  console.log(`${out[0]} ${out[1]} ${out[2]}`);
  return 0;
};
