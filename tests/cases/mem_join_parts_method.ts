// The negative of `mem_join_parts_scope` for the methods: `pop` is a method on
// `parts` that is neither `push` nor `join`, and it hands a part back out, so
// the pushed strings escape as they always did and the loop that calls the
// function keeps what it allocated. `lastOf` returns the popped part, and
// `noteFirst` keeps the first one it pops in its caller's object, which reads
// back intact after 999 more passes and `churn` have reused every byte a wrong
// release would have freed. The language's other array methods (`indexOf`,
// `set`, `fill`) answer no part.
class Log {
  first: string;

  constructor() {
    this.first = "";
  }
}

const lastOf = (n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<${n}.${i}>`);
  }
  return parts.pop();
};

const noteFirst = (log: Log, n: i32): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(`<${n}.${i}>`);
  }
  const popped = parts.pop();
  if (log.first.length === 0) {
    log.first = popped;
  }
  return parts.join("-");
};

const run = (log: Log, calls: i32): string => {
  let total = 0;
  for (let i = 0; i < calls; i++) {
    total = total + lastOf(1 + (i % 9)).length + noteFirst(log, 2 + (i % 9)).length;
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
