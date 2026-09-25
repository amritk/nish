// The negatives of the per-pass scope: a pass whose allocation outlives it
// keeps its memory, and the value reads back intact after `churn` has reused
// every byte a wrong release would have freed. Each function is named for
// the way out it takes.
class Log {
  last: string;
  items: string[];

  constructor() {
    this.last = "";
    this.items = [];
  }
}

const word = (i: i32): string => `word-${i}`;

// Kept in a local declared outside the loop.
const keepLast = (rounds: i32): string => {
  let last = "";
  for (let i = 0; i < rounds; i++) {
    const w = word(i);
    last = w;
  }
  return last;
};

// Pushed into an array older than the pass.
const keepAll = (rounds: i32): string[] => {
  const out: string[] = [];
  for (let i = 0; i < rounds; i++) {
    out.push(word(i));
  }
  return out;
};

// Grows an array older than the pass: the growth is arena memory the pass
// allocates, although what it holds is a number.
const growAll = (rounds: i32): i32[] => {
  const out: i32[] = [];
  for (let i = 0; i < rounds; i++) {
    const w = word(i);
    out.push(w.length);
  }
  return out;
};

// Stored into a field of an object older than the pass.
const keepField = (log: Log, rounds: i32): void => {
  for (let i = 0; i < rounds; i++) {
    const w = word(i);
    log.last = w;
  }
};

// Stored by a callee.
const remember = (log: Log, s: string): void => {
  log.items.push(s);
};

const keepThroughCallee = (log: Log, rounds: i32): i32 => {
  let n = 0;
  for (let i = 0; i < rounds; i++) {
    remember(log, word(i));
    n++;
  }
  return n;
};

// Allocated and stored by a callee: nothing in the loop body escapes itself.
const note = (log: Log, i: i32): void => {
  log.items.push(word(i));
};

const keepInCallee = (log: Log, rounds: i32): i32 => {
  let n = 0;
  for (let i = 0; i < rounds; i++) {
    note(log, i);
    n++;
  }
  return n;
};

// A string built across passes.
const joined = (rounds: i32): string => {
  let s = "";
  for (let i = 0; i < rounds; i++) {
    s = s + word(i);
  }
  return s;
};

// Returned from inside the loop.
const firstLong = (rounds: i32, want: i32): string => {
  for (let i = 0; i < rounds; i++) {
    const w = word(i);
    if (w.length >= want) {
      return w;
    }
  }
  return "";
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};

export const main = (): void => {
  const last = keepLast(50);
  const all = keepAll(50);
  const grown = growAll(50);
  const log = new Log();
  keepField(log, 50);
  const n = keepThroughCallee(log, 50);
  const noted = new Log();
  const m = keepInCallee(noted, 50);
  const s = joined(12);
  const long = firstLong(500, 8);
  console.log(`${churn()}`);
  console.log(last);
  console.log(`${all.length} ${all[0]} ${all[49]}`);
  console.log(`${grown.length} ${grown[0]} ${grown[49]}`);
  console.log(log.last);
  console.log(`${n} ${log.items[0]} ${log.items[49]}`);
  console.log(`${m} ${noted.items[0]} ${noted.items[49]}`);
  console.log(s);
  console.log(long);
};
