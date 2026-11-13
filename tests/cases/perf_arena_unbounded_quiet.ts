// NL9018 stays silent: each loop below either releases what a pass allocates
// before the next pass, is bounded by a count, or is already named by another
// retention warning. Compiled with no NL9018.
class Entry {
  id: i32;
  constructor(id: i32) {
    this.id = id;
  }
}

class Log {
  last: Entry;
  total: i32;
  left: i32;
  constructor() {
    this.last = new Entry(0);
    this.total = 0;
    this.left = 0;
  }
}

// The poll each loop below waits on: nothing the program holds bounds it.
const more = (log: Log): boolean => {
  log.left = log.left - 1;
  return log.left >= 0;
};

// The rewrite NL9018 names: the temporary lives in a block that opens with
// `using a = arena()`, so its memory goes back at the end of every pass.
const serve = (log: Log): void => {
  let served = 0;
  while (more(log)) {
    {
      using a = arena();
      const reply = `request ${served}`;
      log.total = log.total + reply.length;
    }
    log.last = new Entry(served);
    served = served + 1;
  }
};

// A counted `for` that keeps what each pass allocates: the count bounds the pile.
const counted = (log: Log, n: i32): void => {
  for (let i = 0; i < n; i++) {
    const cell = `cell ${i}`;
    log.total = log.total + cell.length;
    log.last = new Entry(i);
  }
};

// NL9016 already names what this loop drops.
const dropped = (log: Log): i32 => {
  let last = "";
  let k = 0;
  while (more(log)) {
    last = `row ${k}`;
    k = k + 1;
  }
  return last.length;
};

// The same drop with its value on the line after its target: still NL9016's
// alone, because the site is the value of the assignment NL9016 sits on.
const droppedSplit = (log: Log): i32 => {
  let last = "";
  let k = 0;
  while (more(log)) {
    last =
      `cell ${k}`;
    log.last = new Entry(k);
    k = k + 1;
  }
  return last.length;
};

// An ordering comparison in a condition that calls nothing bounds a loop, so
// these are silent though each pass stores into memory older than the loop.
const scans = (log: Log, xs: i32[], n: i32): void => {
  let i = 0;
  while (i < n) {
    const a = `a ${i}`;
    log.total = log.total + a.length;
    log.last = new Entry(i);
    i = i + 1;
  }
  for (let k: i32 = 0; k < toI32(xs.length); k++) {
    const b = `b ${k}`;
    log.total = log.total + b.length;
    log.last = new Entry(k);
  }
  let j = n - 1;
  while (j >= 0 && j < n) {
    const c = `c ${j}`;
    log.total = log.total + c.length;
    log.last = new Entry(j);
    j = j - 1;
  }
};

// Adds to an array its caller passes: a call that resizes an array.
const grow = (xs: i32[]): void => {
  xs.push(xs.length);
};

// A local array that only the loop reads: the call in the body resizes some
// other array, and cannot reach this one, so the walk is bounded.
const owned = (log: Log, other: i32[]): void => {
  const ids = [1, 2];
  for (const id of ids) {
    const mark = `mark ${id}`;
    log.total = log.total + mark.length;
    log.last = new Entry(id);
    grow(other);
  }
};

// The array a field holds, walked while a call resizes some other array:
// the body never adds to `batch.ids`, so the walk is bounded.
class Batch {
  ids: i32[];
  constructor() {
    this.ids = [3, 4];
  }
}

const fielded = (log: Log, batch: Batch, other: i32[]): void => {
  for (const id of batch.ids) {
    const tag = `tag ${id}`;
    log.total = log.total + tag.length;
    log.last = new Entry(id);
    grow(other);
  }
};

// Nothing a pass allocates outlives it, so each pass gets a scope.
const scoped = (log: Log): i32 => {
  let total = 0;
  let k = 0;
  while (more(log)) {
    const s = `n${k}`;
    total = total + s.length;
    k = k + 1;
  }
  return total;
};

// A temporary built only on the pass that returns or breaks: every path from
// it leaves the loop, so it is built at most once each time the loop runs.
const finds = (log: Log): i32 => {
  let k = 0;
  while (more(log)) {
    log.last = new Entry(k);
    k = k + 1;
    if (k === 2) {
      const found = `found ${k}`;
      return found.length;
    }
    if (k === 9) {
      const gone = `gone ${k}`;
      log.total = log.total + gone.length;
      break;
    }
  }
  return 0;
};

// A board that keeps the last title it is given.
class Board {
  title: string;
  constructor() {
    this.title = "";
  }
}

// Stores its argument into the board, which is older than any loop that calls it.
const pin = (board: Board, title: string): void => {
  board.title = title;
};

// Each pass hands its title to `pin`, which keeps it: memory the program
// still reaches, not a temporary the pass drops.
const posts = (log: Log, board: Board): void => {
  let k = 0;
  while (more(log)) {
    pin(board, `post ${k}`);
    k = k + 1;
  }
};

export const main = (): void => {
  const log = new Log();
  log.left = 3;
  serve(log);
  counted(log, 3);
  log.left = 4;
  const d = dropped(log);
  log.left = 2;
  const e = droppedSplit(log);
  scans(log, [1, 2], 2);
  owned(log, [0]);
  fielded(log, new Batch(), [0]);
  log.left = 5;
  const k = scoped(log);
  log.left = 5;
  const f = finds(log);
  const board = new Board();
  log.left = 2;
  posts(log, board);
  console.log(`${log.total} ${log.last.id} ${d} ${e} ${k} ${f} ${board.title}`);
};
