// WP15 §8: a loop over a call that leaves arena memory behind, in a function
// that gets no automatic arena scope. Each list `makeList` returns is garbage
// once its length is read, but `tally` stores a string where its caller can
// reach it, and `drain` calls a function that releases the arena, so neither
// can release on return and every pass's list stays allocated. Both are
// reported, each naming what refused the scope; `quiet` is the same loop in a
// function that does get the scope, and says nothing.
class Log {
  last: string = "";
}

const makeList = (n: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i);
  }
  return xs;
};

const tally = (log: Log, rounds: i32): i32 => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total += makeList(i).length;
  }
  log.last = `${total}`;
  return total;
};

const flush = (): void => {
  const m = Arena.mark();
  Arena.release(m);
};

const drain = (rounds: i32): i32 => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total += makeList(i).length;
    flush();
  }
  return total;
};

const quiet = (rounds: i32): i32 => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total += makeList(i).length;
  }
  return total;
};

export const main = (): number => {
  const log = new Log();
  console.log(tally(log, 10));
  console.log(log.last);
  console.log(drain(10));
  console.log(quiet(10));
  return 0;
};
