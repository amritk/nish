// WP15 §8: a loop over a call that leaves arena memory behind, where neither
// a scope around each pass nor one around the function takes it back. Each
// list `makeList` returns is garbage once its length is read, but each pass
// of `tally` stores a string where its caller can reach it, `drain` calls a
// function that releases the arena, and `collect` grows an array older than
// the pass and returns it, so none of them can release a pass or its own
// frame and every pass's list stays allocated. All three are reported, each
// naming what refused both scopes; `quiet` is the same loop with its passes
// scoped, and says nothing.
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
    log.last = `${total}`;
  }
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

const collect = (rounds: i32): i32[] => {
  const lengths: i32[] = [];
  for (let i = 0; i < rounds; i++) {
    lengths.push(makeList(i).length);
  }
  return lengths;
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
  console.log(collect(10).length);
  console.log(quiet(10));
  return 0;
};
