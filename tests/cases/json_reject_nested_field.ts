// Typed JSON: the field rule holds for every class the call reaches, so a
// field two classes down, through an array's element, is refused at the call
// as one on `T` itself is.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Leaf {
  weight: u8 = 0;
}

class Branch {
  leaves: Leaf[];
  constructor() {
    this.leaves = [];
  }
}

class Tree {
  root: Branch;
  constructor() {
    this.root = new Branch();
  }
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  return jsonDecode(d, new Tree());
};
