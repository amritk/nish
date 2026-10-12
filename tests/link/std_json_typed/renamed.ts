// `renamed.ll` beside this module is the golden of the code written for the
// options and for `JsonNumber`: `id` read and written under the key
// `user_id`, `tries` optional, so that its missing key stores its
// initializer where any other missing key calls `missingField`, and `amount`
// read and written whole as a number's text.
import { JsonWriter } from "nish/json";
import { JsonDecoder, JsonNumber, jsonDecode, jsonEncode } from "nish/json-typed";

export class Renamed {
  static readonly json = { rename: { id: "user_id" }, optional: ["tries"] };
  amount: JsonNumber;
  id: i32 = 0;
  tries: i32 = 3;

  constructor() {
    this.amount = new JsonNumber();
  }
}

export const renamedDecode = (d: JsonDecoder, r: Renamed): i32 => jsonDecode(d, r);

export const renamedEncode = (w: JsonWriter, r: Renamed): void => {
  jsonEncode(w, r);
};
