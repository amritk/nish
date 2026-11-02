// NL2613: a task that answers a handle hands a region to another thread.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { scope } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const make = (n: i32): Region<Box> => region((): Box => new Box());

export const main = (): i32 => {
  const out: Region<Box>[] = [];
  {
    using s = scope();
    s.spawn(make, 1, out, 0);
  }
  return out.length;
};
