// NL2486: typed JSON's value is not a declared class.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, "text");
  return w.failed;
};
