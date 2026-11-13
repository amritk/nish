// NL9019 reports each function below: each keeps an array of its own on
// every call, and each sits behind a guard that is not a latch, so the work
// runs on every pass of the loop in `main`, not once.

class State {
  busy: boolean = false;
  ready: boolean = false;
  done: boolean = false;
  seen: boolean = false;
  armed: boolean = false;
  loaded: boolean = false;
  opened: boolean = false;
  gated: boolean = false;
  n: i32 = 0;
  count: i32 = 0;
}

// A re-entrancy guard: it stores `false` back, so the next call passes it.
const guarded = (s: State): i32 => {
  if (s.busy) {
    return 0;
  }
  s.busy = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  s.busy = false;
  return xs.length;
};

// A negated guard returns until the field is set, and runs after.
const whenReady = (s: State): i32 => {
  if (!s.ready) {
    return 0;
  }
  s.ready = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  return xs.length;
};

// A compound guard does not hold just because its field was set.
const untilDone = (s: State): i32 => {
  if (s.done && s.n > 5) {
    return 0;
  }
  s.done = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  return xs.length;
};

// A counter guard runs the work a hundred times.
const capped = (s: State): i32 => {
  if (s.count > 100) {
    return 0;
  }
  const xs: string[] = [];
  xs.push(`${s.count}`);
  s.count = s.count + 1;
  return xs.length;
};

// A latch on its parameter, run on a different object on every pass.
const mark = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// The same latch, run on a local the loop assigns again on every pass.
const stamp = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// The same latch again, reached through a helper that hands on an object
// made every pass. The helper answers a string, so it takes no scope that
// would release what `primed` keeps.
const primed = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};
const primeVia = (item: State): string => `${primed(item)}`;

// A latch the program clears elsewhere: `invalidate` stores `false` back.
const armedWork = (s: State): i32 => {
  if (s.armed) {
    return 0;
  }
  s.armed = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  return xs.length;
};
const invalidate = (s: State): void => {
  s.armed = false;
};

// A latch cleared through another name for the same object.
const loadedWork = (s: State): i32 => {
  if (s.loaded) {
    return 0;
  }
  s.loaded = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  return xs.length;
};
const unload = (s: State): void => {
  const t = s;
  t.loaded = false;
};

// Work before the guard runs on every call, latch or not.
const early = (s: State): i32 => {
  const tmp: string[] = [];
  tmp.push(`${s.n}`);
  if (s.opened) {
    return tmp.length;
  }
  s.opened = true;
  return tmp.length;
};

// A second way out between the guard and the store leaves the latch unset.
const gated = (s: State): i32 => {
  if (s.gated) {
    return 0;
  }
  if (s.count < 0) {
    return 0;
  }
  s.gated = true;
  const xs: string[] = [];
  xs.push(`${s.n}`);
  return xs.length;
};

class Holder {
  cur: State; next: State;
  constructor() { this.cur = new State(); this.next = new State(); }

  renew(): void {
    this.next = new State();
  }
}

// A latch run on a field the loop stores a new object into on every pass.
const prep = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// The same, where a method on the holder stores the new object.
const prepNext = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

export const main = (): void => {
  const s = new State();
  const items: State[] = [];
  for (let i = 0; i < 1000; i++) {
    items.push(new State());
  }
  let cur = new State();
  const names: string[] = [];
  for (let i = 0; i < 1000; i++) {
    names.push(`${guarded(s) + whenReady(s) + untilDone(s) + capped(s) + stamp(cur)}${primeVia(cur)}`);
    cur = new State();
  }
  // Each call below is on the same object every pass; the latches still do
  // not hold.
  const t = new State();
  const h = new Holder();
  for (let i = 0; i < 1000; i++) {
    names.push(`${armedWork(t) + loadedWork(t) + early(t) + gated(t)}`);
    invalidate(t);
    unload(t);
  }
  for (let i = 0; i < 1000; i++) {
    h.cur = new State();
    names.push(`${prep(h.cur)}`);
    h.renew();
    names.push(`${prepNext(h.next)}`);
  }
  let marked = 0;
  for (const item of items) {
    marked = marked + mark(item);
    names.push(`${marked}`);
  }
  console.log(`${names.length} ${names[0]} ${names[999]} ${marked}`);
};
