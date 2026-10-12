// Writes through what a function reads back out of its own containers: a
// `get`, `getOrInsert`'s answer, a walk of `values()`, of a `Set`, of nested
// maps and of an array. Each element is a fresh object the function made, so
// the writes land in its own memory and nothing the task reads.
import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";

class Leaf {
  x: i32 = 0;
}

class Mid {
  leaf: Leaf;

  constructor() {
    this.leaf = new Leaf();
  }
}

class Item {
  name: string;
  v: i32;

  constructor(name: string, v: i32) {
    this.name = name;
    this.v = v;
  }
}

class Holder {
  leaf: Leaf;
  items: Item[];

  constructor() {
    this.leaf = new Leaf();
    this.items = [new Item("a", 1), new Item("b", 2)];
  }
}

const read = (h: Holder): i32 => h.leaf.x + h.items[0].v;

/** get_write */
const work1 = (h: Holder): i32 => {
  const m = new Map<string, Leaf>();
  m.set("a", new Leaf());
  const l = m.get("a");
  if (l !== undefined) {
    l.x = 1;
  }
  return m.size;
};

/** goi_write */
const work2 = (h: Holder): i32 => {
  const m = new Map<string, Leaf>();
  getOrInsert(m, "a", new Leaf()).x = 1;
  return (m.get("a") ?? new Leaf()).x;
};

/** values_write */
const work3 = (h: Holder): i32 => {
  const m = new Map<string, Mid>();
  m.set("a", new Mid());
  m.set("b", new Mid());
  let t = 0;
  for (const v of m.values()) {
    v.leaf.x = 1;
    t = t + v.leaf.x;
  }
  return t;
};

/** set_walk_write */
const work4 = (h: Holder): i32 => {
  const st = new Set<Leaf>();
  st.add(new Leaf());
  st.add(new Leaf());
  let t = 0;
  for (const l of st) {
    l.x = 2;
    t = t + l.x;
  }
  return t;
};

/** nested2 */
const work5 = (h: Holder): i32 => {
  const outer = new Map<string, Map<string, Leaf>>();
  outer.set("a", new Map<string, Leaf>());
  const inner = outer.get("a");
  if (inner !== undefined) {
    inner.set("x", new Leaf());
  }
  let t = 0;
  for (const m of outer.values()) {
    for (const l of m.values()) {
      l.x = 3;
      t = t + l.x;
    }
  }
  return t;
};

/** arr_walk */
const work6 = (h: Holder): i32 => {
  const ls = [new Leaf(), new Leaf()];
  for (const l of ls) {
    l.x = 1;
  }
  return ls[0].x + ls[1].x;
};

/** arr_store_walk */
const work7 = (h: Holder): i32 => {
  const arr = [new Mid(), new Mid()];
  for (const m of arr) {
    m.leaf = new Leaf();
  }
  arr[0].leaf.x = 1;
  return arr[0].leaf.x;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let r = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    r = r + work1(h);
    r = r + work2(h);
    r = r + work3(h);
    r = r + work4(h);
    r = r + work5(h);
    r = r + work6(h);
    r = r + work7(h);
  }
  console.log(`${done[0]} ${r} ${h.leaf.x}`);
  return 0;
};
