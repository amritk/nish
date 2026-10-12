import { parallelMap } from "nish/threads";
class Item {
  x: i32 = 0;
}
class Bag {
  items: Item[];
  constructor() {
    this.items = [new Item()];
  }
}
const first = (b: Bag): Item => b.items[0];
export const main = (): i32 => {
  const cap = new Bag();
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    const it = first(cap);
    it.x = it.x + 1;
    return x;
  });
  console.log(`${cap.items[0].x} ${ys.length}`);
  return 0;
};
