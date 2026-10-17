// A worker's answers reach the caller's arena by adoption: the transfer blocks
// a map's chunk filled, and a task's answer of 64 KB or more, are linked into
// the caller's chunk list rather than copied. An adopted block is released
// exactly when a copied value would have been. Each shape below adopts, then
// lets a release run, and reads what must survive after `churn()`, which
// reuses the memory a block released too early would leave a value in.
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

// Adoption inside a `using a = arena()` block: strings of 64 KB or more
// received from a channel in the block are adopted after its mark, so its
// release frees them, and only a number leaves. (A map that answers strings
// may run in the block too, so long as none of its strings outlives it:
// `tests/link/mem_using_arena_map`.) The string made before the block is below
// its mark and survives, and so does one adopted before a block whose mark
// then sits at the end of that full block.
const inArena = (): string => {
  const before = word(7);
  const ch = new Channel<string>();
  const sent: i32[] = [0];
  {
    using s = scope();
    s.spawn(send, new Pipe(ch, 3), sent, 0);
  }
  let t = 0;
  {
    using a = arena();
    for (const got of ch) {
      t = t + sumOf(got);
    }
    churn();
  }
  churn();
  const late = new Channel<string>();
  {
    using s = scope();
    s.spawn(send, new Pipe(late, 2), sent, 0);
  }
  let u = 0;
  for (const got of late) {
    using a = arena();
    churn();
    u = u + sumOf(got);
  }
  return `${before} ${sent[0]} ${t} ${u}`;
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

// Every shape a body takes is kept by the chunk, whatever its own lowering:
// a named function, an arrow whose call to a helper is its last act (a tail
// call inside the arrow), and an arrow answering one of two calls.
const label = (i: i32): string => `L${i}`;

const shapes = (n: i32): string => {
  const xs = parallelFrom(n, (i) => i);
  const a = parallelMap(xs, word);
  const b = parallelFrom(n, label);
  const c = parallelMap(xs, (x) => label(x + 1));
  const d = parallelMap(xs, (x) => (x % 3 === 0 ? word(x) : big("e", 1 + (x % 4))));
  churn();
  return `${a[n - 1]} ${b[n - 1]} ${c[n - 1]} ${d[n - 1]} ${wordsSum(a) + wordsSum(b) + wordsSum(c) + wordsSum(d)}`;
};

// A map into a destination its caller made, so older than every mark the map
// takes: the adopted blocks outlive the call that adopted them.
const fill = (xs: i32[], dst: string[]): i32 => {
  parallelMapInto(xs, dst, (x) => word(x * 7));
  return dst.length;
};

const into = (n: i32): string => {
  const dst: string[] = [];
  for (let i = 0; i < n; i++) {
    dst.push("");
  }
  const xs = parallelFrom(n, (i) => i);
  const len = fill(xs, dst);
  churn();
  return `${len} ${dst[0]} ${dst[n - 1]} ${wordsSum(dst)}`;
};

// One element of an adopted block of many, answered by a function, directly
// and through one more call. Neither call is reclaimed (WP9's
// `nish_arena_keep`, which moves the newest value down to the mark and assumes
// it ends the arena): a function that runs a map of strings stores what the
// map answers, and so does every function that reaches one, which is what the
// reclaim refuses. The golden pins it: `picked` brackets neither call with
// `nish_arena_keep`, which `reclaimAfter` does around `fetchBig`, whose task's
// answer is a block of its own.
const pick = (n: i32, k: i32): string => {
  const xs = parallelFrom(n, (i) => i + k);
  const ws = parallelMap(xs, (x) => word(x));
  return ws[n / 2];
};

const relay = (n: i32, k: i32): string => {
  const s = pick(n, k + 10);
  return s;
};

const picked = (n: i32): string => {
  const kept: string[] = [];
  for (let k = 0; k < 4; k++) {
    kept.push(pick(n, k));
    kept.push(relay(n, k));
  }
  churn();
  return `${kept[0]} ${kept[7]} ${wordsSum(kept)}`;
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
  console.log(shapes(500));
  console.log(shapes(80000));
  console.log(inArena());
  console.log(into(80000));
  console.log(picked(80000));
  return 0;
};
