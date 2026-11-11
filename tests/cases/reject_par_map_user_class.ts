// A program's own class named `Map` is walked field by field: its `i32[]`
// could be the array `parallelMapInto` is writing.
import { parallelMapInto } from "nish/threads";

class Map {
  entryValues: i32[];

  constructor(values: i32[]) {
    this.entryValues = values;
  }
}

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const docs: Map[] = [new Map(out), new Map(out)];
  parallelMapInto(docs, out, (x: Map): i32 => x.entryValues[0]);
  return out[0];
};
