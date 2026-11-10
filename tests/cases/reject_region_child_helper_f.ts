// NL2697: a helper the `enter`'s function calls may not make the child: only
// the function `enter` runs is known to run with the region entered.
import { Region, child, enter, free, region } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const make = (): Item => new Item("kid");
const helper = (): Region<Item> => child(make);
const keep = (root: Item): Region<Item> => helper();

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
