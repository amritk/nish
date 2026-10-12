import { scope } from "nish/threads";
class Item { name: string; n: i32; constructor(name: string, n: i32) { this.name = name; this.n = n; } }
const readItems = (items: Item[]): i32 => { let t = 0; for (const it of items) { t += it.n; } return t; };
const build = (items: Item[]): i32 => { const ix = new Map<string, Item>(); for (const it of items) { ix.set(it.name, it); } return ix.size; };
export const main = (): i32 => {
  const items: Item[] = [new Item("a", 1), new Item("b", 2), new Item("a", 3)]; const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(readItems, items, done, 0); r = build(items); }
  console.log(`${done[0]} ${r}`); return 0;
};
