// NL9018: a loop that nothing bounds keeps what each pass allocates. Each pass
// below stores an allocation into a structure older than the loop, so no pass
// gets a scope of its own, and a temporary the pass builds and drops piles up
// until the function returns. Nothing the program holds bounds the passes: the
// loops run until a poll says stop, which in a server is never.
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

// The poll a request loop waits on: true while there is more to serve.
const more = (log: Log): boolean => {
  log.left = log.left - 1;
  return log.left >= 0;
};

// A loop on a poll with one temporary per pass: the shape of a request loop.
const serve = (log: Log): void => {
  let served = 0;
  while (more(log)) {
    const reply = `request ${served}`;
    log.total = log.total + reply.length;
    log.last = new Entry(served);
    served = served + 1;
  }
};

// A counted `for` nested in a loop that nothing bounds: the count bounds one
// round, and nothing bounds the rounds.
const rounds = (log: Log, n: i32): void => {
  let round = 0;
  while (true) {
    if (!more(log)) {
      break;
    }
    for (let i = 0; i < n; i++) {
      const cell = `${round}:${i}`;
      log.total = log.total + cell.length;
      log.last = new Entry(i);
    }
    round = round + 1;
  }
};

// Two temporaries in one pass: the warning names the first and counts the rest.
const pair = (log: Log): void => {
  let k = 0;
  while (more(log)) {
    const name = `k${k}`;
    const label = `#${k + 1}`;
    log.total = log.total + name.length + label.length;
    log.last = new Entry(k);
    k = k + 1;
  }
};

// An ordering comparison does not bound a loop: `sent` never moves toward
// `total`, so the poll alone decides how many passes run.
const drain = (log: Log, total: i32): void => {
  const sent = 0;
  while (sent < total && more(log)) {
    const line = `sent ${log.total}`;
    log.total = log.total + line.length;
    log.last = new Entry(sent);
  }
};

// A `for...of` whose body pushes onto what it walks is not counted: each pass
// may add the next one.
const walk = (log: Log, queue: i32[]): void => {
  for (const id of queue) {
    const tag = `id ${id}`;
    log.total = log.total + tag.length;
    log.last = new Entry(id);
    if (more(log)) {
      queue.push(id + 1);
    }
  }
};

// A condition that allocates runs outside the scope a pass takes, on every
// pass of a loop that nothing bounds.
const probe = (log: Log): void => {
  while (`${log.left}`.length > 0 && more(log)) {
    log.last = new Entry(log.left);
  }
};

// A flag with no comparison: whatever sets it decides how many passes run.
const flag = (log: Log): void => {
  let running = true;
  while (running) {
    const note = `left ${log.left}`;
    log.total = log.total + note.length;
    log.last = new Entry(log.left);
    running = more(log);
  }
};

// A top-level `||`, an accept loop's shape: either side can keep it going,
// whatever the other compares.
const accept = (log: Log): void => {
  let next = 0;
  while (next >= 0 || next === -2) {
    const peer = `peer ${next}`;
    log.total = log.total + peer.length;
    log.last = new Entry(next);
    next = more(log) ? next + 1 : -1;
  }
};

export const main = (): void => {
  const log = new Log();
  log.left = 3;
  serve(log);
  log.left = 2;
  rounds(log, 3);
  log.left = 2;
  pair(log);
  log.left = 2;
  drain(log, 5);
  log.left = 2;
  walk(log, [7]);
  log.left = 2;
  probe(log);
  log.left = 2;
  flag(log);
  log.left = 2;
  accept(log);
  console.log(`${log.total} ${log.last.id}`);
};
