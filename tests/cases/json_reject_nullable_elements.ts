// Typed JSON: an array's elements may not be `| null`; only the field
// holding the array may.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Names {
  list: (string | null)[];
  constructor() {
    this.list = [];
  }
}

export const main = (): i32 => jsonDecode(new JsonDecoder([], 0, 0, new JsonLimits()), new Names());
