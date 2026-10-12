// NL2487: a `readonly` field of a class `jsonDecode` decodes into.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Ticket {
  readonly serial: i32 = 0;
}

export const main = (): i32 => jsonDecode(new JsonDecoder([], 0, 0, new JsonLimits()), new Ticket());
