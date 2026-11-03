// NL2387: `using` takes only `scope()`, `lock()` or `arena()`, so a region
// in a later declarator is refused: a block does not free it.
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
    using a = arena(), r = region((): Box => new Box());
  }
  return 0;
};
