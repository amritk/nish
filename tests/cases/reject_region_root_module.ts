// NL2614: `region(() => moduleValue)`: the root must be memory the region
// allocated, not a module's value (here a string, the only kind of module
// value that is not a number or a boolean).
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const shared: string = "shared";

export const main = (): i32 => {
  const r = region((): string => shared);
  free(r);
  return 0;
};
