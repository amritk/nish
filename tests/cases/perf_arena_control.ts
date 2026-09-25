// WP15 §8 and #216: the arena-loop warning's silences. `managed` brackets its
// own passes with `Arena.mark()` / `Arena.release(m)`, so its author is
// managing that memory and nothing is reported although it returns a pointer
// and keeps a string of each pass in its log; `summarise` returns a pointer
// too, and its passes are scoped by the compiler. Neither says anything, and
// the arena grows by the two boxes and the log's string, not by 400 lists.
class Log {
  last: string = "";
}

class Box {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

const makeList = (n: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i);
  }
  return xs;
};

const managed = (log: Log, rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    const m = Arena.mark();
    total += makeList(i).length;
    Arena.release(m);
  }
  log.last = `${total}`;
  return new Box(total);
};

const summarise = (rounds: i32): Box => {
  let total = 0;
  for (let i = 0; i < rounds; i++) {
    total += makeList(i).length;
  }
  return new Box(total);
};

export const main = (): number => {
  const log = new Log();
  const before = Arena.used();
  const a = managed(log, 200).n;
  const b = summarise(200).n;
  console.log(a);
  console.log(b);
  console.log(log.last);
  console.log(Arena.used() - before);
  return 0;
};
