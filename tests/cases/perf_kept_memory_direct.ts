// NL9019 reports each function below: each keeps an array of its own on
// every call, and a loop pass in `main` that releases nothing calls it
// directly. No guard exempts it, whatever object the call receives: a
// re-entrancy guard, a negated or compound guard and a counter run the work
// again, and a once-guard on a field is reported even where it holds.

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

// A once-guard on its parameter, run on a different object on every pass.
const mark = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// The same once-guard, run on a local the loop assigns again on every pass.
const stamp = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// A once-guard the program clears elsewhere: `invalidate` stores `false` back.
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

// A once-guard cleared through another name for the same object.
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

// Work before the guard runs on every call, guarded or not.
const early = (s: State): i32 => {
  const tmp: string[] = [];
  tmp.push(`${s.n}`);
  if (s.opened) {
    return tmp.length;
  }
  s.opened = true;
  return tmp.length;
};

// A second way out between the guard and the store leaves the flag unset.
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

// A callee replaces the object during the pass: `renewG` stores a new one.
const renewG = (g: Holder): void => {
  g.cur = new State();
};

// A once-guard run on a field the loop stores a new object into on every pass.
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

// The same once-guard, run on a field the loop replaces through `renewG`.
const prepG = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

// The same once-guard, run on a field the loop replaces through a name for the
// holder made before the loop.
const prepAlias = (item: State): i32 => {
  if (item.seen) {
    return 0;
  }
  item.seen = true;
  const xs: string[] = [];
  xs.push(`${item.n}`);
  return xs.length;
};

class Once {
  done: boolean = false;
}

// A once-guard on one object the loop never replaces: the work runs once,
// but the rule does not prove which object reaches it, so it still warns.
const warmOnce = (o: Once): i32 => {
  if (o.done) {
    return 0;
  }
  o.done = true;
  const xs: string[] = [];
  xs.push(`${o.done}`);
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
    names.push(`${guarded(s) + whenReady(s) + untilDone(s) + capped(s) + stamp(cur)}`);
    cur = new State();
  }
  // Each call below is on the same object every pass, and the guard is
  // cleared, bypassed or preceded by the work.
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
  const g = new Holder();
  for (let i = 0; i < 1000; i++) {
    renewG(g);
    names.push(`${prepG(g.cur)}`);
  }
  const hh = new Holder();
  const alias = hh;
  for (let i = 0; i < 1000; i++) {
    alias.cur = new State();
    names.push(`${prepAlias(hh.cur)}`);
  }
  const once = new Once();
  for (let i = 0; i < 1000; i++) {
    names.push(`${warmOnce(once)}`);
  }
  let marked = 0;
  for (const item of items) {
    marked = marked + mark(item);
    names.push(`${marked}`);
  }
  console.log(`${names.length} ${names[0]} ${names[999]} ${marked}`);
};
