// A worker's answers reach the caller's arena by adoption: the transfer blocks
// a map's chunk filled, and a task's answer of 64 KB or more, are linked into
// the caller's chunk list rather than copied. An adopted block is released
// exactly when a copied value would have been. Each shape below adopts, then
// lets a release run, and reads what must survive after `churn()`, which
// reuses the memory a block released too early would leave a value in.
import { Channel, Mutex, parallelFrom, parallelMap, scope } from "nish/threads";

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

// A string of `n` pieces, about 7 bytes each, joined once.
const big = (tag: string, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`${tag}${i % 1000},`);
  }
  return parts.join("");
};

// A checksum that reads every byte's neighbourhood cheaply.
const sumOf = (s: string): i32 => {
  let t = 0;
  for (let i = 0; i < s.length; i = i + 97) {
    t = t + s.charCodeAt(i);
  }
  return t + s.length;
};

const word = (x: i32): string => `w${x}`;

const wordsSum = (ws: string[]): i32 => {
  let t = 0;
  for (const w of ws) {
    t = t + w.length + w.charCodeAt(w.length - 1);
  }
  return t;
};

// A body that calls a function answering a fresh string: the chunk keeps each
// answer in a transfer block, small (below the grain) and large.
const reclaimable = (n: i32): string => {
  const xs = parallelFrom(n, (i) => i);
  const ws = parallelMap(xs, (x) => word(x));
  churn();
  return `${ws[0]} ${ws[n - 1]} ${ws.length} ${wordsSum(ws)}`;
};

// Nested blocks: the inner block's adopted answers are read in the outer one,
// after the inner one's own arena work has been released.
const nested = (): string => {
  let keep: string[] = [];
  {
    const xs = parallelFrom(70000, (i) => i * 2);
    {
      const ws = parallelMap(xs, (x) => `n${x}`);
      keep = ws;
    }
    churn();
  }
  churn();
  return `${keep[0]} ${keep[69999]} ${wordsSum(keep)}`;
};

// A body answering one string of more than 64 KB: it outgrows a transfer
// block, so the chunk gives it a block of its own. (A map inside a body or a
// task is refused by the checker: it writes the array it answers.)
const inner = (k: i32): string => {
  const ws: string[] = [];
  for (let i = 0; i < 12000; i++) {
    ws.push(`${k}:${i};`);
  }
  return ws.join("");
};

const bigRows = (): string => {
  const ks = parallelFrom(6, (k) => k);
  const rows = parallelMap(ks, (k) => inner(k));
  churn();
  let t = 0;
  for (const r of rows) {
    t = t + sumOf(r);
  }
  return `${rows.length} ${rows[5].length} ${rows[5].substring(0, 8)} ${t}`;
};

class Words {
  ws: string[];

  constructor(ws: string[]) {
    this.ws = ws;
  }
}

// A task handed a map's adopted answers, which answers them joined: they are
// copied out again, and the join adopts that answer in turn.
const joined = (w: Words): string => w.ws.join("");

// Tasks answering strings of 64 KB or more, adopted at the join, then read
// after the scope's own work has been released.
const tasks = (round: i32): string => {
  const out: string[] = ["", "", "", ""];
  const ws = parallelFrom(70000, (i) => `${round}-${i}`);
  {
    using s = scope();
    s.spawn(joined, new Words(ws), out, 0);
    for (let i = 1; i < 4; i++) {
      s.spawn((n: i32): string => big("t", n), 16000 + i + round, out, i);
    }
  }
  churn();
  let t = 0;
  for (const o of out) {
    t = t + sumOf(o);
  }
  return `${out[0].length} ${out[3].length} ${t}`;
};

// The answer of `tasks` is made in its frame and answered: the frame's release
// gives back the adopted blocks, and the answer must have left with it.
const twice = (): string => {
  const a = tasks(1);
  churn();
  const b = tasks(2);
  churn();
  return `${a} | ${b}`;
};

// A call per iteration whose callee adopts a task's answer and answers it: the
// caller keeps it past the callee's release (WP9's reclaim, after adoption).
const fetchBig = (k: i32): string => {
  const out: string[] = [""];
  {
    using s = scope();
    s.spawn((n: i32): string => big("f", n), 15000 + k, out, 0);
  }
  return out[0];
};

const reclaimAfter = (): string => {
  const kept: string[] = [];
  for (let k = 0; k < 4; k++) {
    kept.push(fetchBig(k));
    kept.push(word(k));
  }
  churn();
  let t = 0;
  for (const s of kept) {
    t = t + sumOf(s);
  }
  return `${kept.length} ${kept[6].length} ${kept[7]} ${t}`;
};

class Pipe {
  ch: Channel<string>;
  n: i32;

  constructor(ch: Channel<string>, n: i32) {
    this.ch = ch;
    this.n = n;
  }
}

// Strings of 64 KB or more sent on a channel and received after the scope.
const send = (p: Pipe): i32 => {
  for (let i = 0; i < p.n; i++) {
    p.ch.send(big("c", 15000 + i));
  }
  return p.n;
};

const channel = (): string => {
  const ch = new Channel<string>();
  const sent: i32[] = [0];
  {
    using s = scope();
    s.spawn(send, new Pipe(ch, 3), sent, 0);
  }
  const got: string[] = [];
  for (const s of ch) {
    got.push(s);
  }
  churn();
  let t = 0;
  for (const s of got) {
    t = t + sumOf(s);
  }
  return `${sent[0]} ${got.length} ${got[2].length} ${t}`;
};

class Slot {
  m: Mutex<string>;
  id: i32;

  constructor(m: Mutex<string>, id: i32) {
    this.m = m;
    this.id = id;
  }
}

// A string of 64 KB or more stored through a guard, read after the scope.
const store = (sl: Slot): i32 => {
  const s = big("g", 15000 + sl.id);
  using g = sl.m.lock();
  if (g.value.length < s.length) {
    g.value = s;
  }
  return s.length;
};

const guard = (): string => {
  const m = new Mutex<string>("");
  const lens: i32[] = [0, 0, 0];
  {
    using s = scope();
    for (let i = 0; i < 3; i++) {
      s.spawn(store, new Slot(m, i), lens, i);
    }
  }
  churn();
  let v = "";
  {
    using g = m.lock();
    v = g.value;
  }
  churn();
  return `${lens[0] + lens[1] + lens[2]} ${v.length} ${sumOf(v)}`;
};

export const main = (): i32 => {
  console.log(reclaimable(500));
  console.log(reclaimable(80000));
  console.log(nested());
  console.log(bigRows());
  console.log(twice());
  console.log(reclaimAfter());
  console.log(channel());
  console.log(guard());
  return 0;
};
