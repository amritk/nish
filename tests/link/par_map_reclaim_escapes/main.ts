// The negatives of `par_map_reclaim`: a function that runs a map and answers a
// number releases its frame when the call returns, because the region joins
// before the map returns and the array it fills is the caller's alone again.
// Each function below answers a number too, but lets what the map made outlive
// the call by another way, so its frame must not release it: returned,
// stored into a field or an outer array, left in an array the caller made,
// handed to a task, kept as an element of an adopted block, nested in an
// array of arrays, chosen by a ternary, pushed onto an array the frame answers,
// stored into a `Map` and a `Set`, sent on a channel, stored through a guard,
// kept by a callee (a generic one too), kept through an alias, carried into the
// next iteration, or read after a nested call that releases its own frame.
// Each reads what must survive after `churn()`, which reuses
// the memory a frame released too early would leave a value in.
import { Channel, Mutex, parallelFrom, parallelMap, parallelMapInto, scope } from "nish/threads";

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

const sum = (ys: i32[]): i32 => {
  let t = 0;
  for (const y of ys) {
    t = (t + y) % 1000003;
  }
  return t;
};

const wordsSum = (ws: string[]): i32 => {
  let t = 0;
  for (const w of ws) {
    t = (t + w.length + w.charCodeAt(w.length - 1)) % 1000003;
  }
  return t;
};

const word = (x: i32): string => `w${x}`;

// Returned: the frame that answers the map's array keeps it, and so does the
// loop that pushes it.
const tripled = (xs: i32[]): i32[] => parallelMap(xs, (x) => x * 3);

const returned = (xs: i32[]): string => {
  const kept: i32[][] = [];
  for (let r = 0; r < 4; r++) {
    kept.push(tripled(xs));
  }
  churn();
  return `${kept.length} ${kept[3][xs.length - 1]} ${sum(kept[0]) + sum(kept[3])}`;
};

class Holder {
  ys: i32[];
  ws: string[];
  first: string;

  constructor() {
    this.ys = [];
    this.ws = [];
    this.first = "";
  }
}

// Stored into a field of an object older than the call: the frame answers a
// number, and the map's array and its strings live in the holder.
const intoField = (h: Holder, xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x) => x + k);
  const ws = parallelMap(xs, (x) => word(x + k));
  h.ys = ys;
  h.ws = ws;
  return ys.length;
};

// One string element of an adopted block, stored on its own: the block that
// holds it must outlive the frame that adopted it.
const firstWord = (h: Holder, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * k));
  h.first = ws[xs.length - 1];
  return ws.length;
};

const field = (xs: i32[]): string => {
  const h = new Holder();
  let n = 0;
  for (let k = 1; k <= 3; k++) {
    n = n + intoField(h, xs, k);
    n = n + firstWord(h, xs, k + 10);
  }
  churn();
  return `${n} ${h.ys[1]} ${h.ws[xs.length - 1]} ${h.first} ${sum(h.ys)} ${wordsSum(h.ws)}`;
};

// Stored into an element of an outer array, of numbers and of strings.
const intoOuter = (rows: i32[][], words: string[][], xs: i32[], at: i32): i32 => {
  const ys = parallelFrom(xs.length, (i) => xs[i] * at);
  rows[at] = ys;
  words[at] = parallelMap(ys, (y) => `o${y}`);
  return ys.length;
};

const outer = (xs: i32[]): string => {
  const rows: i32[][] = [[], [], []];
  const words: string[][] = [[], [], []];
  let n = 0;
  for (let at = 0; at < 3; at++) {
    n = n + intoOuter(rows, words, xs, at);
  }
  churn();
  return `${n} ${rows[2][1]} ${words[2][xs.length - 1]} ${sum(rows[1])} ${wordsSum(words[1])}`;
};

// A map into an array its caller made, and another call that allocates in the
// same frame: the frame may release its own work, but not the strings the map
// left in `out`, which live in blocks adopted after the frame's mark.
const fillOuter = (xs: i32[], out: string[], k: i32): i32 => {
  const scratch = parallelMap(xs, (x) => x - k);
  parallelMapInto(xs, out, (x) => word(x + k));
  return sum(scratch);
};

// A map whose body answers the elements of a local array as they are: the
// strings `local` holds end up in `out`, and must outlive the frame that made
// them.
const passThrough = (xs: i32[], out: string[], k: i32): i32 => {
  const local = parallelMap(xs, (x) => `p${x + k}`);
  parallelMapInto(local, out, (s) => s);
  return local.length;
};

const into = (xs: i32[]): string => {
  const out: string[] = [];
  const out2: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    out.push("");
    out2.push("");
  }
  let t = 0;
  for (let k = 0; k < 3; k++) {
    t = (t + fillOuter(xs, out, k)) % 1000003;
    t = (t + passThrough(xs, out2, k)) % 1000003;
  }
  churn();
  return `${t} ${out[0]} ${out[xs.length - 1]} ${out2[xs.length - 1]} ${wordsSum(out)} ${wordsSum(out2)}`;
};

class Box {
  ws: string[];

  constructor(ws: string[]) {
    this.ws = ws;
  }
}

const joined = (b: Box): string => `${b.ws[0]}+${b.ws[b.ws.length - 1]}+${b.ws.length}`;

// Handed to a task: the map's strings reach a task that answers a string made
// of them, which the join adopts and the frame stores into an array older than
// the call.
const toTask = (xs: i32[], answers: string[], at: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * 5 + at));
  const got = [""];
  {
    using s = scope();
    s.spawn(joined, new Box(ws), got, 0);
  }
  answers[at] = got[0];
  return ws.length;
};

const task = (xs: i32[]): string => {
  const answers: string[] = ["", "", ""];
  let n = 0;
  for (let at = 0; at < 3; at++) {
    n = n + toTask(xs, answers, at);
  }
  churn();
  return `${n} ${answers[0]} ${answers[2]}`;
};

// An array of arrays of numbers, answered by the map's body (the join copies
// each one out of the worker's arena), stored outside. A body may not answer
// an array of strings: `outer` builds the `string[][]` from maps instead.
const nestedInto = (xs: i32[], keep: i32[][][], at: i32): i32 => {
  const rows = parallelMap(xs, (x) => [x + at, x * 2 + at]);
  keep[at] = rows;
  return rows.length;
};

const nested = (xs: i32[]): string => {
  const keep: i32[][][] = [[], []];
  let n = 0;
  for (let at = 0; at < 2; at++) {
    n = n + nestedInto(xs, keep, at);
  }
  churn();
  const last = keep[1][xs.length - 1];
  let t = 0;
  for (const row of keep[0]) {
    t = (t + sum(row)) % 1000003;
  }
  return `${n} ${last[0]} ${last[1]} ${keep[0][0][1]} ${t}`;
};

// A string element of a map's adopted block, answered by a function and kept
// by a caller in a local across later calls. A map of strings stores what it
// answers, so the call is not reclaimed, and the string must survive the
// calls after it.
const pick = (xs: i32[], k: i32): string => {
  const ws = parallelMap(xs, (x) => word(x + k));
  const mid: i32 = xs.length >> 1;
  return ws[mid];
};

const picked = (xs: i32[]): string => {
  let last = "";
  let t = 0;
  for (let k = 0; k < 6; k++) {
    const s = pick(xs, k);
    t = t + s.length + s.charCodeAt(s.length - 1);
    last = s;
  }
  churn();
  return `${last} ${t}`;
};

// Chosen by a ternary: either map's array is answered.
const choose = (xs: i32[], c: boolean): i32[] => {
  const ys = parallelMap(xs, (x) => x + 1);
  const zs = parallelMap(xs, (x) => x + 2);
  return c ? ys : zs;
};

const chooseWords = (xs: i32[], c: boolean): string[] => {
  const ys = parallelMap(xs, (x) => word(x + 1));
  const zs = parallelMap(xs, (x) => word(x + 2));
  return c ? ys : zs;
};

const ternary = (xs: i32[]): string => {
  const a = choose(xs, true);
  const b = choose(xs, false);
  const c = chooseWords(xs, true);
  const d = chooseWords(xs, false);
  churn();
  return `${a[0]} ${b[xs.length - 1]} ${c[0]} ${d[xs.length - 1]} ${sum(a) + sum(b)} ${wordsSum(c) + wordsSum(d)}`;
};

// Pushed onto an array of the same frame, which the frame answers.
const pushed = (xs: i32[]): i32[][] => {
  const rows: i32[][] = [];
  for (let r = 0; r < 3; r++) {
    const q = r;
    const ys = parallelMap(xs, (x) => x * q);
    rows.push(ys);
  }
  return rows;
};

const pushedWords = (xs: i32[]): string[] => {
  const strs: string[] = [];
  for (let r = 0; r < 3; r++) {
    const q = r;
    const ws = parallelMap(xs, (x) => word(x * q));
    strs.push(ws[xs.length - 1]);
  }
  return strs;
};

const push = (xs: i32[]): string => {
  const rows = pushed(xs);
  const strs = pushedWords(xs);
  churn();
  return `${rows.length} ${rows[2][xs.length - 1]} ${sum(rows[1])} ${strs[0]} ${strs[2]}`;
};

// Stored into a Map and a Set older than the call.
const intoMap = (m: Map<i32, i32[]>, s: Set<string>, xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x) => x + k);
  const ws = parallelMap(xs, (x) => word(x + k));
  m.set(k, ys);
  s.add(ws[0]);
  s.add(ws[xs.length - 1]);
  return ys.length;
};

const maps = (xs: i32[]): string => {
  const m = new Map<i32, i32[]>();
  const s = new Set<string>();
  let n = 0;
  for (let k = 0; k < 3; k++) {
    n = n + intoMap(m, s, xs, k);
  }
  churn();
  const two = m.get(2);
  const last = word(xs[xs.length - 1] + 2);
  return `${n} ${two === undefined ? -1 : sum(two)} ${s.size} ${s.has(last)}`;
};

// Sent on a channel the parent receives after the scope.
const sender = (ch: Channel<string>): i32 => {
  ch.send("t");
  return 1;
};

const sendWords = (xs: i32[], got: string[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x + k));
  const ch = new Channel<string>();
  ch.send(ws[0]);
  ch.send(ws[xs.length - 1]);
  const n: i32[] = [0];
  {
    using s = scope();
    s.spawn(sender, ch, n, 0);
  }
  for (const w of ch) {
    got.push(w);
  }
  return ws.length;
};

const channel = (xs: i32[]): string => {
  const got: string[] = [];
  let n = 0;
  for (let k = 0; k < 3; k++) {
    n = n + sendWords(xs, got, k);
  }
  churn();
  return `${n} ${got.length} ${wordsSum(got)}`;
};

// Stored through a Mutex guard.
class Slot {
  s: string;
  n: i32;

  constructor() {
    this.s = "";
    this.n = 0;
  }
}

const guarded = (m: Mutex<Slot>, xs: i32[], k: i32): i32 => {
  const ws = parallelMap(xs, (x) => word(x * k));
  const ys = parallelMap(xs, (x) => x * k);
  using g = m.lock();
  g.value.s = ws[xs.length - 1];
  g.value.n = ys[xs.length - 1];
  return ws.length;
};

const mutex = (xs: i32[]): string => {
  const m = new Mutex<Slot>(new Slot());
  let n = 0;
  for (let k = 1; k <= 3; k++) {
    n = n + guarded(m, xs, k);
  }
  churn();
  using g = m.lock();
  return `${n} ${g.value.s} ${g.value.n}`;
};

class Sink {
  ys: i32[];
  w: string;

  constructor() {
    this.ys = [];
    this.w = "";
  }
}

const keepYs = (h: Sink, ys: i32[]): void => {
  h.ys = ys;
};

const keepWord = (h: Sink, w: string): void => {
  h.w = w;
};

class Cell<T> {
  v: T;

  constructor(v: T) {
    this.v = v;
  }
}

const keepAny = <T>(c: Cell<T>, v: T): void => {
  c.v = v;
};

// Handed to a callee that stores its parameter, plain and generic.
const sunk = (h: Sink, c: Cell<i32[]>, d: Cell<string>, xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x) => x + k);
  const ws = parallelMap(xs, (x) => word(x + k));
  const zs = parallelMap(xs, (x) => x - k);
  keepYs(h, ys);
  keepWord(h, ws[1]);
  keepAny(c, zs);
  keepAny(d, ws[xs.length - 1]);
  return ys.length;
};

const callee = (xs: i32[]): string => {
  const h = new Sink();
  const c = new Cell<i32[]>([]);
  const d = new Cell<string>("");
  let n = 0;
  for (let k = 0; k < 3; k++) {
    n = n + sunk(h, c, d, xs, k);
  }
  churn();
  return `${n} ${sum(h.ys)} ${h.w} ${sum(c.v)} ${d.v}`;
};

// An alias of the map's array, or of one of its strings, that escapes.
const aliased = (h: Sink, xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x) => x * 2 + k);
  const zs = ys;
  h.ys = zs;
  const ws = parallelMap(xs, (x) => word(x + k));
  const w = ws[xs.length - 1];
  const v = w;
  h.w = v;
  return ys.length;
};

const alias = (xs: i32[]): string => {
  const h = new Sink();
  let n = 0;
  for (let k = 0; k < 3; k++) {
    n = n + aliased(h, xs, k);
  }
  churn();
  return `${n} ${sum(h.ys)} ${h.ys[0]} ${h.w}`;
};

// The result of one iteration read in the next.
const carried = (xs: i32[]): string => {
  let prev: i32[] = [];
  let prevWords: string[] = [];
  let t = 0;
  for (let r = 0; r < 4; r++) {
    if (r > 0) {
      t = (t + sum(prev) + wordsSum(prevWords)) % 1000003;
    }
    const q = r;
    prev = parallelMap(xs, (x) => x + q);
    prevWords = parallelMap(xs, (x) => word(x + q));
    churn();
  }
  return `${t} ${prev[xs.length - 1]} ${prevWords[0]}`;
};

// Read after a nested call that marks and releases its own frame.
const reclaims = (xs: i32[], k: i32): i32 => {
  const ys = parallelMap(xs, (x) => x * k);
  return sum(ys);
};

const afterNested = (xs: i32[]): string => {
  const ys = parallelMap(xs, (x) => x + 5);
  const ws = parallelMap(xs, (x) => word(x + 5));
  let t = 0;
  for (let k = 0; k < 3; k++) {
    t = (t + reclaims(xs, k)) % 1000003;
  }
  churn();
  return `${t} ${sum(ys)} ${ys[xs.length - 1]} ${wordsSum(ws)} ${ws[0]}`;
};

export const main = (): i32 => {
  for (const n of [37, 70000]) {
    const xs = parallelFrom(n, (i) => (i * 7919) % 10007);
    console.log(returned(xs));
    console.log(field(xs));
    console.log(outer(xs));
    console.log(into(xs));
    console.log(task(xs));
    console.log(nested(xs));
    console.log(picked(xs));
    console.log(ternary(xs));
    console.log(push(xs));
    console.log(maps(xs));
    console.log(channel(xs));
    console.log(mutex(xs));
    console.log(callee(xs));
    console.log(alias(xs));
    console.log(carried(xs));
    console.log(afterNested(xs));
  }
  return 0;
};
