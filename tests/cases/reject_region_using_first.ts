// NL2387: a region in the first declarator of a `using` is refused too.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

export const main = (): i32 => {
  {
    using r = region((): Box => new Box()), a = arena();
  }
  return 0;
};
