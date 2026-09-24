// #174: two modules each declare a class `Base` with a constructor. A
// constructor is the symbol `Base.constructor`, named after its class, so the
// two collide. Since #193 the two classes are refused first, by name (NL3028),
// before their members are compared, and the shared constructor is not
// reported as a second mistake: the program gets one diagnostic, not two.
import { one } from "./lib";

class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const main = (): i32 => new Base(one()).x;
