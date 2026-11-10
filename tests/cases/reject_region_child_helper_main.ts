// NL2697: a helper that makes a child, called from `main`, has no region
// entered, wherever `main` itself is called.
import { Region, child, free } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const make = (): Item => new Item("kid");
const helper = (): Region<Item> => child(make);

export const main = (): i32 => {
  free(helper());
  return 0;
};
