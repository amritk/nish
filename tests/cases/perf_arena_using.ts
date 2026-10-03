// NL9011 stays quiet for a call inside a `using a = arena()` block: the block
// releases what `build` leaves behind on every pass, although the pass itself
// gets no scope (it stores a string of each round into `log`) and `collect`,
// which returns a pointer, gets none either. Without the `using` line the
// same loop is the arena-loop warning's shape.
class Log {
  last: string = "";
  total: i32 = 0;
}

const build = (n: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i);
  }
  return xs;
};

const collect = (rounds: i32, log: Log): Log => {
  for (let i = 0; i < rounds; i++) {
    log.last = `round ${i}`;
    using a = arena();
    const xs = build(64 + i);
    log.total = log.total + xs.length;
  }
  return log;
};

export const main = (): void => {
  const log = collect(100, new Log());
  console.log(`${log.total} ${log.last}`);
};
