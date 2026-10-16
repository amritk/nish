// A task answers a `string` or an array of numbers, booleans or enums, and the
// join copies it out of the worker's arena into the parent's (copy-at-join).
// Each shape below is one way a string or an array reaches a task's answer;
// `churn()` reuses the arena memory a missed copy would leave the parent
// pointing at, so a missing copy prints garbage rather than the right text.
import { Mutex, scope } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

// Concatenation in the worker: every intermediate lives in its arena.
const label = (n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`${i},`);
  }
  return parts.join("") + "";
};

class Person {
  name: string;
  age: i32;

  constructor(name: string, age: i32) {
    this.name = name;
    this.age = age;
  }
}

// A string field of an object the task built: the object stays behind, the
// field's string crosses.
const nameOf = (n: i32): string => {
  const p = new Person(`person-${n}`, n);
  return p.name;
};

class Text {
  body: string;

  constructor(body: string) {
    this.body = body;
  }
}

// A string the task was handed, answered as is: it was not born in the
// worker's arena, so the copy passes it through.
const echo = (t: Text): string => t.body;

// A slice and a substring of a string the worker built.
const middle = (n: i32): string => label(n).substring(2, 8);
const tail = (n: i32): string => {
  const t = label(n);
  return t.slice(t.length - 4, t.length);
};

// Scalar arrays: filled in the worker, copied whole at the join.
const squares = (n: i32): i32[] => {
  const out: i32[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i * i);
  }
  return out;
};

const halves = (n: i32): f64[] => {
  const out: f64[] = [];
  let x: f64 = 0;
  for (let i = 0; i < n; i++) {
    out.push(x);
    x = x + 0.5;
  }
  return out;
};

const evens = (n: i32): boolean[] => {
  const out = new Array<boolean>(n);
  for (let i = 0; i < out.length; i++) {
    out[i] = i % 2 === 0;
  }
  return out;
};

// A callee fills a fresh array and returns it; the task that calls it writes
// nothing shared.
const build = (n: i32): i32[] => {
  const xs = new Array<i32>(n);
  for (let i = 0; i < xs.length; i++) {
    xs[i] = n - i;
  }
  return xs;
};

const first = (n: i32): i32 => {
  const ys = build(n);
  return ys[0] + ys[n - 1];
};

class Log {
  last: string;
  count: i32;

  constructor() {
    this.last = "";
    this.count = 0;
  }
}

class Job {
  m: Mutex<Log>;
  id: i32;

  constructor(m: Mutex<Log>, id: i32) {
    this.m = m;
    this.id = id;
  }
}

// A task that both stores a string into a guard and answers one.
const record = (job: Job): string => {
  const mine = `job-${job.id}`;
  {
    using g = job.m.lock();
    g.value.last = mine;
    g.value.count = g.value.count + 1;
  }
  return mine + "!";
};

export const main = (): i32 => {
  const names: string[] = ["", "", "", "", "", "", "", ""];
  const sq: i32[][] = [[], []];
  const hv: f64[][] = [[]];
  const ev: boolean[][] = [[]];
  const firsts: i32[] = [0];
  const done: string[] = ["", "", "", ""];
  const m = new Mutex<Log>(new Log());
  const given = new Text(`given-${names.length}`);
  {
    using s = scope();
    s.spawn(label, 5, names, 0);
    s.spawn(label, 300, names, 1);
    s.spawn(nameOf, 7, names, 2);
    s.spawn(echo, given, names, 3);
    s.spawn(middle, 9, names, 4);
    s.spawn(tail, 12, names, 5);
    s.spawn(label, 0, names, 6);
    s.spawn(squares, 6, sq, 0);
    s.spawn(squares, 2000, sq, 1);
    s.spawn(halves, 5, hv, 0);
    s.spawn(evens, 5, ev, 0);
    s.spawn(first, 9, firsts, 0);
    for (let i = 0; i < 4; i++) {
      s.spawn(record, new Job(m, i), done, i);
    }
  }
  const c = churn();
  console.log(names[0]);
  console.log(`${names[1].length} ${names[1].substring(0, 12)} ${names[2]} ${names[3]}`);
  console.log(`[${names[4]}] [${names[5]}] [${names[6]}] ${names[7].length}`);
  console.log(`${sq[0][5]} ${sq[0].length} ${sq[1].length} ${sq[1][1999]}`);
  console.log(`${hv[0][3]} ${hv[0].length} ${ev[0][2]} ${ev[0][3]} ${ev[0].length} ${firsts[0]}`);
  console.log(`${done[0]} ${done[1]} ${done[2]} ${done[3]} ${c}`);
  let count = 0;
  let last = 0;
  {
    using g = m.lock();
    count = g.value.count;
    last = g.value.last.length;
  }
  console.log(`${count} ${last}`);
  return 0;
};
