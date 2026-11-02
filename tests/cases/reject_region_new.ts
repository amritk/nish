// NL2618: a `Region` is made by `region` or `regionWith`, never by `new`.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

export const main = (): i32 => {
  const r = new Region<Box>();
  free(r);
  return 0;
};
