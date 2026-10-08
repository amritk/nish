// The negative of `mem_join_parts_scope`: a part read back out of `parts`
// with `parts[i]` may outlive the call, so the pushed string escapes as it
// always did, and the loop that calls the function keeps what it allocated.
// `firstOf` hands the part back; `noteFirst` keeps it in its caller's object,
// which reads back intact after `churn` has reused every byte a wrong release
// would have freed.
class Log {
  first: string;

  constructor() {
    this.first = "";
  }
}

const firstOf = (n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<${i}>`);
  }
  return parts[0];
};

const noteFirst = (log: Log, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<${n}.${i}>`);
  }
  log.first = parts[0];
  return parts.join("-");
};

const run = (log: Log, calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    total = total + firstOf(1 + (i % 9)).length + noteFirst(log, 1 + (i % 9)).length;
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
  console.log(log.first);
};
