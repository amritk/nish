// The negative of `mem_join_parts_scope`: `parts` is only pushed onto and
// joined, but it is not an array literal of its own — it names `mine`, and a
// part read back through `mine` may outlive the call. So the pushed strings
// escape as they always did and the loop that calls the function keeps what it
// allocated. The part kept in the caller's object reads back intact after
// `churn` has reused every byte a wrong release would have freed.
class Log {
  first: string;

  constructor() {
    this.first = "";
  }
}

const noteFirst = (log: Log, n: i32): string => {
  const mine: string[] = [];
  const parts = mine;
  for (let i = 0; i < n; i++) {
    parts.push(`<${n}.${i}>`);
  }
  log.first = mine[0];
  return parts.join("-");
};

const run = (log: Log, calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    total = total + noteFirst(log, 1 + (i % 9)).length;
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
