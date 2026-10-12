// Typed JSON: a `Map`'s value is a new object for each key, made by the
// decoder with `new Pet()`, so its class's constructor may take nothing.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Pet {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Shelter {
  pets: Map<string, Pet>;
  constructor() {
    this.pets = new Map<string, Pet>();
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Shelter());
};
