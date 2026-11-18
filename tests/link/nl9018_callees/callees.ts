// Shapes of NL9018's callee summary that `tests/run.js` pins by line. Each
// loop stores into memory older than a pass, so it releases nothing per
// pass, and calls a function that is refused a scope of its own because it
// stores into the tally too.
//
// - `serveA` and `serveB` reach `c`'s string through the recursion `a ⇄ b`:
//   whichever loop is checked first, both warn.
// - `serveCtor` reaches a constructor that dispatches on its parameter.
// - `serveLet` calls `step`, which compares against a `let`: not a dispatch,
//   so no warning.
// - `servePanic` calls `check`, whose string is the message of a `panic` in
//   the statement after it: not charged to the loop.
class Entry {
  id: i32
  constructor(id: i32) {
    this.id = id
  }
}

class Tally {
  n: i32
  left: i32
  last: Entry
  constructor() {
    this.n = 0
    this.left = 100
    this.last = new Entry(0)
  }
}

const more = (t: Tally): boolean => {
  t.left = t.left - 1
  return t.left >= 0
}

const c = (t: Tally, kind: i32): void => {
  const s = `c ${kind}`
  t.last = new Entry(kind)
  t.n = t.n + s.length
};

const a = (t: Tally, kind: i32): void => {
  b(t, kind)
  c(t, kind)
};

const b = (t: Tally, kind: i32): void => {
  if (kind === 1) {
    a(t, 0)
  }
};

const serveA = (t: Tally): void => {
  while (more(t)) {
    t.last = new Entry(t.left)
    a(t, 2)
  }
};

const serveB = (t: Tally): void => {
  while (more(t)) {
    t.last = new Entry(t.left)
    b(t, 1)
  }
};

class Handler {
  n: i32
  constructor(t: Tally, kind: i32) {
    this.n = 0
    if (kind === 1) {
      const s = `k ${kind}`
      t.last = new Entry(kind)
      t.n = t.n + s.length
    }
  }
}

const handle = (t: Tally): void => {
  const h = new Handler(t, 1)
  t.n = t.n + h.n
};

const serveCtor = (t: Tally): void => {
  while (more(t)) {
    t.last = new Entry(t.left)
    handle(t)
  }
};

const step = (t: Tally, kind: i32): void => {
  let current = 3
  current = current + t.left
  if (kind === current) {
    const s = `s ${kind}`
    t.last = new Entry(kind)
    t.n = t.n + s.length
  }
};

const serveLet = (t: Tally): void => {
  while (more(t)) {
    t.last = new Entry(t.left)
    step(t, 1)
  }
};

const check = (t: Tally, kind: i32): void => {
  t.last = new Entry(kind)
  t.n = t.n + 1
  if (kind === 7) {
    const msg = `bad kind ${kind}`
    panic(msg)
  }
};

const servePanic = (t: Tally): void => {
  while (more(t)) {
    t.last = new Entry(t.left)
    check(t, 1)
  }
};

export const main = (): void => {
  const t = new Tally()
  serveA(t)
  serveB(t)
  serveCtor(t)
  serveLet(t)
  servePanic(t)
  console.log(t.n)
};
