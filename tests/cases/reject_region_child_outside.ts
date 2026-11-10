// NL2697: `child` outside the function `enter` runs has no parent.
import { child, free } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

export const main = (): i32 => {
  const c = child((): Item => new Item("orphan"));
  free(c);
  return 0;
};
