// Typed JSON: the top-level value is an object, so `T` is a class; an array
// of them is refused at the call, not decoded element by element.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Row {
  id: i32 = 0;
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  const rows: Row[] = [];
  return jsonDecode(d, rows);
};
