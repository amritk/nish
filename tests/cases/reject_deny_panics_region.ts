// --deny-panics refuses a call to `nish:region`: every call checks its
// handle at run time and stops the program on a bad one (the `region` kind).
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

export const count = (): i32 => {
  const r = region((): Box => new Box());
  free(r);
  return 0;
};
