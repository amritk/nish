// #174: two modules each declare a class `Base` with a constructor. A
// constructor is the symbol `Base.constructor`, named after its class, so the
// two collide; the refusal names the class and both files, and carries a
// registered `--json` code (NL3022) rather than NL0000. Two same-named classes
// with fields alone would compile: only a shared member collides.
import { one } from "./lib";

class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const main = (): i32 => new Base(one()).x;
