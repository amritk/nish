// The negatives of a frame that hands its map's strings to a callee: a
// function that runs a string map and passes the array to a callee that keeps
// none of it gives its frame back when it returns (`par_map_reclaim`). Each
// callee below keeps a string, or the array, past the call by another way, so
// the frame that made them must not release them: stored into a field,
// returned, captured by a map's body, pushed onto an older array, stored into
// a `Map`, passed to `new`, stored by a constructor that hands `this` out,
// stored through the second declarator of a statement, stored through a local
// alias, relayed to a callee that keeps it, or kept by a callee that takes a
// `string[][]`, which the proof leaves out. Each reads what must survive after
// `churn()`, which reuses the memory a frame released too early would leave a
// value in. There is no module-level array to store into: a module constant is
// a number, a boolean or a string.
import { parallelFrom, parallelMap } from "nish/threads";

// Each string is kept, so the loop writes over the whole of what was freed
// rather than over the one string a rewound iteration reuses.
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

const wordsSum = (ws: string[]): i32 => {
  let t = 0;
  for (const w of ws) {
    t = (t + w.length + w.charCodeAt(w.length - 1)) % 1000003;
  }
  return t;
};

const word = (x: i32): string => `w${x}`;

class Box {
  ws: string[];

  constructor(ws: string[]) {
    this.ws = ws;
  }
}

class Holder {
  ws: string[];
  w: string;
  b: Box;
  last: Tag | null;

  constructor() {
    this.ws = [];
    this.w = "";
    this.b = new Box([]);
    this.last = null;
  }
}

// A constructor that stores an element on the object it makes and hands the
// object to an older one.
class Tag {
  w: string;

  constructor(h: Holder, ws: string[]) {
    this.w = ws[ws.length - 1];
    h.last = this;
  }
}

const keepField = (h: Holder, ws: string[]): i32 => {
  h.w = ws[ws.length - 1];
  return ws.length;
};

const keepArray = (h: Holder, ws: string[]): i32 => {
  h.ws = ws;
  return ws.length;
};

const last = (ws: string[]): string => ws[ws.length - 1];

const same = (ws: string[]): string[] => ws;

// The map's body reads the parameter: its strings come back as they are.
const keepCaptured = (h: Holder, ws: string[]): i32 => {
  const idx = parallelFrom(ws.length, (i) => i);
  h.ws = parallelMap(idx, (i) => ws[i]);
  return ws.length;
};

const keepPushed = (out: string[], ws: string[]): i32 => {
  out.push(ws[ws.length - 1]);
  return ws.length;
};

const keepMapped = (m: Map<i32, string>, ws: string[], k: i32): i32 => {
  m.set(k, ws[ws.length - 1]);
  return ws.length;
};

const keepNew = (h: Holder, ws: string[]): i32 => {
  h.b = new Box(ws);
  return ws.length;
};

const keepThis = (h: Holder, ws: string[]): i32 => {
  const t = new Tag(h, ws);
  return t.w.length;
};

const keepSecond = (h: Holder, ws: string[]): i32 => {
  const a = ws[0], b = ws[ws.length - 1];
  h.w = b;
  return a.length;
};

const keepAliased = (h: Holder, ws: string[]): i32 => {
  const v = ws;
  h.ws = v;
  return v.length;
};

const relay = (h: Holder, ws: string[]): i32 => keepField(h, ws) + 1;

const keepNested = (h: Holder, wss: string[][]): i32 => {
  let n = 0;
  for (const ws of wss) {
    h.w = ws[ws.length - 1];
    n = n + ws.length;
  }
  return n;
};

// Each frame answers a number, so it would release what its map made if the
// callee's proof were wrong.
const field = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x + k));
  return keepField(h, ws);
};

const array = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 2 + k));
  return keepArray(h, ws);
};

const returned = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 5 + k));
  h.w = last(ws);
  return ws.length;
};

const returnedArray = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 7 + k));
  h.ws = same(ws);
  return ws.length;
};

const captured = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 11 + k));
  return keepCaptured(h, ws);
};

const pushed = (out: string[], xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 13 + k));
  return keepPushed(out, ws);
};

const mapped = (m: Map<i32, string>, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 17 + k));
  return keepMapped(m, ws, k);
};

const boxed = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 19 + k));
  return keepNew(h, ws);
};

const tagged = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 23 + k));
  return keepThis(h, ws);
};

const second = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 29 + k));
  return keepSecond(h, ws);
};

const aliased = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 31 + k));
  return keepAliased(h, ws);
};

const relayed = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 37 + k));
  return relay(h, ws);
};

const nested = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 41 + k));
  const wss: string[][] = [ws];
  return keepNested(h, wss);
};

// The control: a callee that keeps none of the strings, so this frame gives
// its map back when it returns.
const counted = (xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 43 + k));
  return wordsSum(ws);
};

const show = (h: Holder): string => `${h.w} ${h.ws.length} ${wordsSum(h.ws)}`;

export const main = (): i32 => {
  for (const n of [37, 70000]) {
    const xs = parallelFrom(n, (i) => (i * 7919) % 10007);
    const h = new Holder();
    const out: string[] = [];
    const m = new Map<i32, string>();
    let t = 0;
    for (let k = 1; k <= 3; k++) {
      t = (t + counted(xs, k)) % 1000003;
    }
    churn();
    console.log(`counted ${t}`);
    for (let k = 1; k <= 3; k++) {
      t = t + field(h, xs, k);
    }
    churn();
    console.log(`field ${t} ${h.w}`);
    for (let k = 1; k <= 3; k++) {
      t = t + array(h, xs, k);
    }
    churn();
    console.log(`array ${t} ${show(h)}`);
    for (let k = 1; k <= 3; k++) {
      t = t + returned(h, xs, k);
    }
    churn();
    console.log(`returned ${t} ${h.w}`);
    for (let k = 1; k <= 3; k++) {
      t = t + returnedArray(h, xs, k);
    }
    churn();
    console.log(`returnedArray ${t} ${show(h)}`);
    for (let k = 1; k <= 3; k++) {
      t = t + captured(h, xs, k);
    }
    churn();
    console.log(`captured ${t} ${show(h)}`);
    for (let k = 1; k <= 3; k++) {
      t = t + pushed(out, xs, k);
    }
    churn();
    console.log(`pushed ${t} ${out.length} ${wordsSum(out)} ${out[0]} ${out[2]}`);
    for (let k = 1; k <= 3; k++) {
      t = t + mapped(m, xs, k);
    }
    churn();
    console.log(`mapped ${t} ${m.get(1) ?? "-"} ${m.get(3) ?? "-"}`);
    for (let k = 1; k <= 3; k++) {
      t = t + boxed(h, xs, k);
    }
    churn();
    console.log(`boxed ${t} ${h.b.ws[0]} ${wordsSum(h.b.ws)}`);
    for (let k = 1; k <= 3; k++) {
      t = t + tagged(h, xs, k);
    }
    churn();
    const tag = h.last;
    console.log(`tagged ${t} ${tag === null ? "-" : tag.w}`);
    for (let k = 1; k <= 3; k++) {
      t = t + second(h, xs, k);
    }
    churn();
    console.log(`second ${t} ${h.w}`);
    for (let k = 1; k <= 3; k++) {
      t = t + aliased(h, xs, k);
    }
    churn();
    console.log(`aliased ${t} ${show(h)}`);
    for (let k = 1; k <= 3; k++) {
      t = t + relayed(h, xs, k);
    }
    churn();
    console.log(`relayed ${t} ${h.w}`);
    for (let k = 1; k <= 3; k++) {
      t = t + nested(h, xs, k);
    }
    churn();
    console.log(`nested ${t} ${h.w}`);
  }
  return 0;
};
