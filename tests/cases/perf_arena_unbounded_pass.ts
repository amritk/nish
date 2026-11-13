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

export const main = (): void => {
  const log = new Log();
  log.left = 3;
  serve(log);
  log.left = 2;
  rounds(log, 3);
  log.left = 2;
  pair(log);
  console.log(`${log.total} ${log.last.id}`);
};
