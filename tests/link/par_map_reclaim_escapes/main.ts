// The negatives of `par_map_reclaim`: a function that runs a map and answers a
// number releases its frame when the call returns, because the region joins
// before the map returns and the array it fills is the caller's alone again.
// Each function below answers a number too, but lets what the map made outlive
// the call by another way, so its frame must not release it: returned,
// stored into a field or an outer array, left in an array the caller made,
// handed to a task, kept as an element of an adopted block, or nested in an
// array of arrays. Each reads what must survive after `churn()`, which reuses
// the memory a frame released too early would leave a value in.
import { parallelFrom, parallelMap, parallelMapInto, scope } from "nish/threads";

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
  }
  return 0;
};
