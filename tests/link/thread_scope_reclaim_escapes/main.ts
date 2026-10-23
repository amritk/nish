// The negatives of a frame that spawns into a `using s = scope()`: such a frame
// gives back what it made when it returns, once its scope has joined
// (`thread_scope_reclaim`), unless what it made outlives it. Each function
// below makes a fresh array, hands it to a task of its own scope, and keeps it
// past the frame by another way: stored into a field, returned, pushed onto an
// older array, stored into a `Map`, passed to `new`, stored by a constructor
// that hands `this` out, relayed to a callee that keeps it, answered by the
// task into a destination the frame then stores, captured by a task and kept,
// spawned through the second declarator of a `using` statement, or stored
// through a local alias. A `using a = arena(), s = scope()` frame hands its
// task an array the arena owns, which the scope reads before the release. A
// last loop spawns what each pass makes onto the
// loop's outer scope, which joins after the passes. Each reads what must
// survive after `churn()`, which reuses the memory a frame released too early
// would leave a value in.
import { AtomicI32, scope } from "nish/threads";

const churn = (): i32 => {
  const kept: string[] = [];
  let t = 0;
  for (let i = 0; i < 6000; i++) {
    const s = `kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk${i}`;
    kept.push(s);
    t = t + s.length;
  }
  return t + kept.length - 6000;
};

const sum = (ys: i32[]): i32 => {
  let t = 0;
  for (const y of ys) {
    t = (t * 31 + y) % 1000003;
  }
  return t;
};

const fresh = (n: i32, k: i32): i32[] => {
  const ys = new Array<i32>(n);
  for (let i = 0; i < ys.length; i++) {
    ys[i] = (i * 7 + k) % 1009;
  }
  return ys;
};

class Holder {
  ys: i32[];
  constructor() {
    this.ys = [];
  }
}

// A field, and the task.
const intoField = (h: Holder, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  h.ys = ys;
  return out[0];
};

// Returned, after the task.
const returned = (n: i32, k: i32): i32[] => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  return ys;
};

// Pushed onto an older array.
const pushed = (rows: i32[][], n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  rows.push(ys);
  return out[0];
};

// Stored into a Map.
const mapped = (m: Map<i32, i32[]>, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  m.set(k, ys);
  return out[0];
};

// Kept by an object whose constructor hands `this` to a registry.
class Reg {
  ys: i32[];
  constructor(list: Reg[], ys: i32[]) {
    this.ys = ys;
    list.push(this);
  }
}

const registered = (list: Reg[], n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  new Reg(list, ys);
  return out[0];
};

// Relayed through a callee that keeps it.
const keep = (h: Holder, ys: i32[]): void => {
  h.ys = ys;
};

const relayed = (h: Holder, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  keep(h, ys);
  return out[0];
};

// The task answers its argument: the destination holds it, and the frame
// stores the answer into a field.
const same = (ys: i32[]): i32[] => ys;

const answered = (h: Holder, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[][] = [[]];
  {
    using s = scope();
    s.spawn(same, ys, out, 0);
  }
  h.ys = out[0];
  return out[0].length;
};

// Captured by a task, and kept in a field.
const captured = (h: Holder, acc: AtomicI32, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  {
    using s = scope();
    s.spawn(() => {
      acc.add(sum(ys));
    });
  }
  h.ys = ys;
  return ys.length;
};

// Passed to `new`, whose constructor stores it.
class Box {
  ys: i32[];
  constructor(ys: i32[]) {
    this.ys = ys;
  }
}

const boxed = (boxes: Box[], n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  boxes.push(new Box(ys));
  return out[0];
};

// Spawned through the second declarator of the statement.
const second = (h: Holder, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  const more: i32[] = [0];
  {
    using s = scope(),
      u = scope();
    s.spawn(sum, ys, out, 0);
    u.spawn(sum, ys, more, 0);
  }
  h.ys = ys;
  return (out[0] + more[0]) % 1000003;
};

// Stored through a local alias.
const aliased = (h: Holder, n: i32, k: i32): i32 => {
  const ys = fresh(n, k);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(sum, ys, out, 0);
  }
  const zs = ys;
  h.ys = zs;
  return out[0];
};

// A pass that spawns onto the loop's own outer scope.
// The accepted order: `s` is declared after the arena, so it joins before the
// block releases, and its task reads the block's array first.
const ordered = (n: i32, k: i32): i32 => {
  const out = new Array<i32>(1);
  {
    using a = arena(),
      s = scope();
    const ys = fresh(n, k + 40);
    s.spawn(sum, ys, out, 0);
  }
  return out[0];
};

const passes = (n: i32): string => {
  const out = new Array<i32>(8);
  {
    using s = scope();
    for (let k = 0; k < 8; k++) {
      const ys = fresh(n, k);
      s.spawn(sum, ys, out, k);
    }
  }
  churn();
  let t = 0;
  for (let k = 0; k < out.length; k++) {
    t = t + out[k];
  }
  return `${t}`;
};

export const main = (): i32 => {
  for (const n of [37, 5000]) {
    const h = new Holder();
    let t = 0;
    for (let k = 0; k < 3; k++) {
      t = (t + intoField(h, n, k)) % 1000003;
    }
    churn();
    console.log(`field ${t} ${sum(h.ys)}`);
    const r = [returned(n, 1), returned(n, 2)];
    churn();
    console.log(`return ${sum(r[0])} ${sum(r[1])}`);
    const rows: i32[][] = [];
    for (let k = 0; k < 3; k++) {
      t = (t + pushed(rows, n, k)) % 1000003;
    }
    churn();
    console.log(`push ${t} ${sum(rows[0])} ${sum(rows[2])}`);
    const m = new Map<i32, i32[]>();
    for (let k = 0; k < 3; k++) {
      t = (t + mapped(m, n, k)) % 1000003;
    }
    churn();
    const two = m.get(2);
    console.log(`map ${t} ${two === undefined ? -1 : sum(two)}`);
    const list: Reg[] = [];
    for (let k = 0; k < 3; k++) {
      t = (t + registered(list, n, k)) % 1000003;
    }
    churn();
    console.log(`ctor ${t} ${sum(list[0].ys)} ${sum(list[2].ys)}`);
    const h2 = new Holder();
    for (let k = 0; k < 3; k++) {
      t = (t + relayed(h2, n, k)) % 1000003;
    }
    churn();
    console.log(`relay ${t} ${sum(h2.ys)}`);
    const h3 = new Holder();
    for (let k = 0; k < 3; k++) {
      t = (t + answered(h3, n, k)) % 1000003;
    }
    churn();
    console.log(`answer ${t} ${sum(h3.ys)}`);
    const h4 = new Holder();
    const acc = new AtomicI32(0);
    for (let k = 0; k < 3; k++) {
      t = (t + captured(h4, acc, n, k)) % 1000003;
    }
    churn();
    console.log(`capture ${t} ${acc.load()} ${sum(h4.ys)}`);
    const boxes: Box[] = [];
    for (let k = 0; k < 3; k++) {
      t = (t + boxed(boxes, n, k)) % 1000003;
    }
    churn();
    console.log(`new ${t} ${sum(boxes[0].ys)} ${sum(boxes[2].ys)}`);
    const h5 = new Holder();
    for (let k = 0; k < 3; k++) {
      t = (t + second(h5, n, k)) % 1000003;
    }
    churn();
    console.log(`declarator ${t} ${sum(h5.ys)}`);
    const h6 = new Holder();
    for (let k = 0; k < 3; k++) {
      t = (t + aliased(h6, n, k)) % 1000003;
    }
    churn();
    console.log(`alias ${t} ${sum(h6.ys)}`);
    for (let k = 0; k < 3; k++) {
      t = (t * 31 + ordered(n, k)) % 1000003;
    }
    churn();
    console.log(`arena ${t}`);
    console.log(`pass ${passes(n)}`);
  }
  return 0;
};
