// Typed JSON: an array's element past the array's end is made with `new C()`,
// so its class's constructor may take no parameters. A nested object that is
// not `| null` is decoded into the one its field holds, so `Owner`'s own
// constructor is not asked about.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Pet {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Owner {
  pets: Pet[];
  constructor(first: Pet) {
    this.pets = [first];
  }
}

class Home {
  owner: Owner;
  constructor() {
    this.owner = new Owner(new Pet("a"));
  }
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  return jsonDecode(d, new Home());
};
