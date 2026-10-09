// The negatives of `mem_return_array_scope` in the function that fills the
// array: each one uses the array in a way that could hand an element on
// besides returning it, so the stored strings escape as they always did and
// the loop that calls the function keeps what it allocated. `stored` keeps
// the array in its caller's object, `passed` hands it to a function that
// keeps an element, `readBack` keeps an element it reads out, `aliased`
// returns the array through another name, and `either` returns it through a
// choice. Each kept string reads back intact after `churn` has reused every
// byte a wrong release would have freed.
class Log {
  items: string[];
  first: string;

  constructor() {
    this.items = [];
    this.first = "";
  }
}

const stored = (log: Log, i: i32): string[] => {
  const xs: string[] = [];
  xs.push(`stored ${i}`);
  log.items = xs;
  return xs;
};

const keepFirst = (log: Log, xs: string[]): void => {
  log.first = xs[0];
};

const passed = (log: Log, i: i32): string[] => {
  const xs: string[] = [];
  xs.push(`passed ${i}`);
  keepFirst(log, xs);
  return xs;
};

const readBack = (log: Log, i: i32): string[] => {
  const xs: string[] = [""];
  xs[0] = `read ${i}`;
  log.first = xs[0];
  return xs;
};

const aliased = (i: i32): string[] => {
  const xs: string[] = [];
  xs.push(`aliased ${i}`);
  const ys = xs;
  return ys;
};

const either = (i: i32, other: string[]): string[] => {
  const xs: string[] = [];
  xs.push(`either ${i}`);
  return i >= 0 ? xs : other;
};

export const main = (): void => {
  const a = new Log();
  const b = new Log();
  const c = new Log();
  // One loop each, so that no negative is refused only because another is.
  let total = 0;
  let viaAlias: string[] = [];
  let viaChoice: string[] = [];
  for (let i = 0; i < 1000; i++) {
    total = total + stored(a, i).length;
  }
  for (let i = 0; i < 1000; i++) {
    total = total + passed(b, i).length;
  }
  for (let i = 0; i < 1000; i++) {
    total = total + readBack(c, i).length;
  }
  for (let i = 0; i < 1000; i++) {
    viaAlias = aliased(i);
  }
  for (let i = 0; i < 1000; i++) {
    viaChoice = either(i, []);
  }
  console.log(`${churn()}`);
  console.log(total);
  console.log(a.items[0]);
  console.log(b.first);
  console.log(c.first);
  console.log(viaAlias[0]);
  console.log(viaChoice[0]);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};
