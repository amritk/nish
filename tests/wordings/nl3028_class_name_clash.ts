// NL3028: this module and `nl3_clash/lib.ts` each declare a class `Base`. A
// struct type is identified by its name alone, so the two would be one type;
// the later declaration in load order, `lib.ts`'s, is refused (#193). The two
// also share `Base.constructor`, which is not reported a second time.
import { anchor } from "./nl3_clash/lib";

class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const main = (): i32 => new Base(anchor()).x;
