// A program's own generic class named `Map` is walked field by field: its
// `V[]` is an `i32[]` here, which could be the array `parallelMapInto` is
// writing.
import { parallelMapInto } from "nish/threads";

class Map<K, V> {
  keys: K[];
  entryValues: V[];

  constructor(keys: K[], values: V[]) {
    this.keys = keys;
    this.entryValues = values;
  }
}

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const docs: Map<string, i32>[] = [new Map<string, i32>(["a"], out), new Map<string, i32>(["b"], out)];
  parallelMapInto(docs, out, (x: Map<string, i32>): i32 => x.entryValues[0]);
  return out[0];
};
