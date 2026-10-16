// The body of a parallel map reads one `Map` and one `Set` that every element
// shares: `get`, `has` and `size` read the tables and write nothing, so the
// workers may look keys up at once and the answer is the loop's. The answers
// are `f64`, so no array inside a table can be the one being written.
import { parallelMapInto } from "nish/threads";

class Tables {
  prices: Map<string, i32>;
  banned: Set<i32>;

  constructor() {
    this.prices = new Map<string, i32>();
    this.prices.set("even", 2);
    this.prices.set("odd", 3);
    this.banned = new Set<i32>();
    this.banned.add(5);
  }
}

class Item {
  id: i32;
  tables: Tables;

  constructor(id: i32, tables: Tables) {
    this.id = id;
    this.tables = tables;
  }
}

const price = (it: Item): f64 => {
  if (it.tables.banned.has(it.id)) {
    return 0.0;
  }
  const key = it.id % 2 === 0 ? "even" : "odd";
  return toF64((it.tables.prices.get(key) ?? 0) + it.tables.prices.size);
};

export const main = (): i32 => {
  const tables = new Tables();
  const items: Item[] = [];
  for (let i = 0; i < 8; i++) {
    items.push(new Item(i, tables));
  }
  const out: f64[] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  parallelMapInto(items, out, price);
  let t = 0;
  for (const p of out) {
    t = t * 10 + toI32(p);
  }
  console.log(`${t}`);
  return 0;
};
