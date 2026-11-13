// NL9018 reports each function below: each keeps an array of its own on
// every call, and each sits behind a guard that is not a latch, so the work
// runs on every pass of the loop in `main`, not once.

class State {
  busy: boolean = false;
  ready: boolean = false;
  done: boolean = false;
  seen: boolean = false;
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

export const main = (): void => {
  const s = new State();
  const items: State[] = [];
  for (let i = 0; i < 1000; i++) {
    items.push(new State());
  }
  let cur = new State();
  const names: string[] = [];
  for (let i = 0; i < 1000; i++) {
    s.n = i;
    names.push(`${guarded(s) + whenReady(s) + untilDone(s) + capped(s) + stamp(cur)}`);
    cur = new State();
  }
  let marked = 0;
  for (const item of items) {
    marked = marked + mark(item);
    names.push(`${marked}`);
  }
  console.log(`${names.length} ${names[0]} ${names[999]} ${marked}`);
};
