// The negative of `mem_join_parts_scope` for a capture: `parts` read by an
// arrow handed to a function is a use like any other, since the arrow is
// handed `parts` as an argument and may read a part back out and keep it. The
// part `log.last` keeps reads back intact after `churn` has reused every byte
// a wrong release would have freed.

class Log {
  last: string;

  constructor() {
    this.last = "";
  }
}

const atLast = (n: i32, f: (i: i32) => void): void => {
  f(n - 1);
};

const noteLast = (log: Log, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<${n}.${i}>`);
  }
  atLast(parts.length, (i) => {
    log.last = parts[i];
  });
  return parts.join("-");
};

const run = (log: Log, calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    total = total + noteLast(log, 1 + (i % 9)).length;
  }
  return `${total}`;
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
  const log = new Log();
  const total = run(log, 1000);
  console.log(`${churn()}`);
  console.log(total);
  console.log(log.last);
};
