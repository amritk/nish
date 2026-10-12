// NL2488: a class the decoder makes whose constructor takes parameters.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Line {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

class Page {
  lines: Line[];
  constructor() {
    this.lines = [];
  }
}

export const main = (): i32 => jsonDecode(new JsonDecoder([], 0, 0, new JsonLimits()), new Page());
