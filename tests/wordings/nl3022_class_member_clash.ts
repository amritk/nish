// NL3022: this module and `nl3_clash/lib.ts` each declare a class `Base` with a
// constructor. A constructor is the symbol `Base.constructor`, named after its
// class, so the two collide however the classes are exported (#174).
import { anchor } from "./nl3_clash/lib";

class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const main = (): i32 => new Base(anchor()).x;
