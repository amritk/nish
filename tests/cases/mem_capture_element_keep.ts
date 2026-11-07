// The negative of `mem_capture_read_scope` for an element: an arrow that
// stores one element of a captured array into an older object keeps that
// element, though it keeps nothing of the array itself (the CG-12 shape on an
// array that is not a `parts` array). Three ways in:
//
// - `build` fills a `string[]` of its own and returns it, the shape whose
//   strings would otherwise go to the caller with the array
//   (`storedIntoReturnedArray`): an array an arrow captures is never such a
//   carrier, because the arrow's reads are not the function's own.
// - `pick` captures a listing, a call that answers fresh strings: the arrow
//   proved nothing free of it (`elementsFree`), so the strings are kept.
// - `hold` captures an array of objects and keeps one of them.
//
// Each of `buildLength`, `pickLength` and `holdLength` drops what it built,
// and the kept value reads back intact after `churn` has reused every byte a
// wrong release would have freed.

class Log {
  last: string;
  first: string;
  box: Box | null;

  constructor() {
    this.last = "";
    this.first = "";
    this.box = null;
  }
}

class Box {
  s: string;

  constructor(s: string) {
    this.s = s;
  }
}

const atLast = (n: i32, f: (i: i32) => void): void => {
  f(n - 1);
};

const build = (log: Log, n: i32): string[] => {
  const xs: string[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(`<${n}.${i}>`);
  }
  atLast(xs.length, (i) => {
    log.last = xs[i];
  });
  return xs;
};

const listing = (n: i32): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`[${n}.${i}]`);
  }
  return out;
};

const pick = (log: Log, n: i32): i32 => {
  const xs = listing(n);
  atLast(xs.length, (i) => {
    log.first = xs[i];
  });
  return xs.length;
};

const hold = (log: Log, n: i32): i32 => {
  const bs = [new Box(`{${n}}`), new Box(`{${n + 1}}`)];
  atLast(bs.length, (i) => {
    log.box = bs[i];
  });
  return bs.length;
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy${i}`.length;
  }
  return t;
};

const buildLength = (log: Log, n: i32): i32 => build(log, n).length;

const pickLength = (log: Log, n: i32): i32 => pick(log, n);

const holdLength = (log: Log, n: i32): i32 => hold(log, n);

export const main = (): void => {
  const log = new Log();
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total = total + buildLength(log, 1 + (i % 9)) + pickLength(log, 1 + (i % 7)) + holdLength(log, i);
  }
  console.log(`${churn()}`);
  const box = log.box;
  console.log(`${total} ${log.last} ${log.first} ${box === null ? "-" : box.s}`);
};
