// The negative of `mem_join_parts_same_pass`: here a part is read back out of
// `parts` and stored into `log`, so the parameter pushed onto it is kept past
// the call, and the loop that builds the argument keeps it rather than
// releasing it after each pass. The word `log.last` holds reads back intact
// after `churn` has reused every byte a wrong release would have freed.
class Log {
  last: string;

  constructor() {
    this.last = "";
  }
}

const quoteKeep = (log: Log, word: string, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(word);
    parts.push(`${i}`);
  }
  log.last = parts[0];
  return parts.join(",");
};

const run = (log: Log, calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    const word = `w${i}`;
    total = total + quoteKeep(log, word, 1 + (i % 9)).length;
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
