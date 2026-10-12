// Tables of a function's own, filled and walked between a scope's first
// `spawn` and its join: a histogram walked by `keys()`, a memo handed down a
// recursion, a sum over `values()`, an index of the argument's items, and
// tables that only hold references to the argument's memory or to the
// function's own objects. Each writes its table and nothing the task reads,
// so native, where the task runs at the join, and Node, where it runs at the
// spawn, print the same.
import { scope } from "nish/threads";

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

/** hist */
const work1 = (h: Holder): i32 => {
  const m = new Map<i32, i32>();
  const xs = [1, 2, 2, 3, 3, 3];
  for (const b of xs) {
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  let t = 0;
  for (const k of m.keys()) {
    t = t + k * (m.get(k) ?? 0);
  }
  return t + h.leaf.x;
};

const fib = (n: i32, memo: Map<i32, i32>): i32 => {
  if (n < 2) {
    return n;
  }
  const got = memo.get(n);
  if (got !== undefined) {
    return got;
  }
  const r = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, r);
  return r;
};

/** memo */
const work2 = (h: Holder): i32 => {
  const memo = new Map<i32, i32>();
  return fib(20 + h.leaf.x, memo);
};

const look = (n: i32, memo: Map<i32, i32>): i32 => {
  memo.set(n, n * 2);
  return memo.size;
};

/** look */
const work3 = (h: Holder): i32 => {
  const memo = new Map<i32, i32>();
  return look(3, memo) + h.leaf.x;
};

/** values */
const work4 = (h: Holder): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  m.set("b", 2);
  let t = 0;
  for (const v of m.values()) {
    t = t + v;
  }
  return t;
};

/** ref_size */
const work5 = (h: Holder): i32 => {
  const m = new Map<string, Leaf>();
  m.set("a", h.leaf);
  return m.size + (m.has("a") ? 1 : 0);
};

/** index */
const work6 = (h: Holder): i32 => {
  const ix = new Map<string, Item>();
  for (const it of h.items) {
    ix.set(it.name, it);
  }
  return ix.size;
};

/** own_obj */
const work7 = (h: Holder): i32 => {
  const m = new Map<string, Leaf>();
  const o = new Leaf();
  m.set("a", o);
  const st = new Set<Leaf>();
  st.add(o);
  return m.size + st.size;
};

/** keyed */
const work8 = (h: Holder): i32 => {
  const m = new Map<Leaf, i32>();
  m.set(h.leaf, (m.get(h.leaf) ?? 0) + 1);
  return m.size;
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
    r = r + work8(h);
  }
  console.log(`${done[0]} ${r} ${h.leaf.x}`);
  return 0;
};
