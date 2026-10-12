// Typed JSON: the field rule reaches into the class of a `| null` field too.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Score {
  points: u16 = 0;
}

class Card {
  score: Score | null = null;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Card());
  return w.failed;
};
