import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; table: Map<string, Leaf>;
  constructor() { this.leaf = new Leaf(); this.table = new Map<string, Leaf>(); this.table.set("x", new Leaf()); }
}
export const main = (): i32 => {
  const h = new Holder();
  console.log(`${h.table.size}`); return 0;
};
