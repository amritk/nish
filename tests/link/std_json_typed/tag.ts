// `tag.ll` beside this module is the golden of the code written for the
// kinds after the first: a `u64`, arrays of them, an enum and an array of
// enums, and the key dispatch between `scores`, `levels` and `totals`, three
// names of six bytes that their first byte tells apart. A map's code is pinned by
// `expected.ir` instead: a module that names `Map` carries its own copy of
// every `Map` method it calls, which would be most of a golden of it.
import { JsonWriter } from "nish/json";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
import { Level } from "./models.ts";

export class Tag {
  id: u64 = 0;
  scores: u64[];
  levels: Level[];
  totals: u64[];
  level: Level;

  constructor() {
    this.scores = [];
    this.totals = [];
    this.levels = [];
    this.level = Level.Low;
  }
}

export const tagDecode = (d: JsonDecoder, t: Tag): i32 => jsonDecode(d, t);

export const tagEncode = (w: JsonWriter, t: Tag): void => {
  jsonEncode(w, t);
};
