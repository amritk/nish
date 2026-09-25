// `for...of` and the per-pass scope. The array a loop iterates is evaluated
// once, before the first pass, so it is older than every pass and its
// elements may be kept; an array a pass allocates is garbage at the end of
// that pass, and so is every element of it, which is why the variable of a
// `for...of` nested in the body counts as the body's own.
//
// `words` stores each string it makes into the array it returns, and the
// escape analysis counts any store of an allocation as an escape, so a loop
// that calls it is never scoped: `lastWord` is refused for that before its
// assignment to `last` is even read. `letters` iterates numbers instead.
class Box {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

const words = (n: i32): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`w${i}`);
  }
  return out;
};

const squares = (n: i32): i32[] => {
  const out: i32[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i * i);
  }
  return out;
};

// A `for...of` over an array each outer pass allocates: the outer pass is scoped.
const letters = (rounds: i32): Box => {
  let total = 0;
  for (let r = 0; r < rounds; r++) {
    for (const x of squares(r % 5)) {
      total += x;
    }
  }
  return new Box(total);
};

// A scoped `for...of` over an array older than every pass, keeping an element.
const longest = (ws: string[]): string => {
  let best = "";
  for (const w of ws) {
    const shout = `${w}!`;
    if (shout.length > best.length + 1) {
      best = w;
    }
  }
  return best;
};

// Negative: an element of an array the pass allocated, kept past the pass.
const lastWord = (rounds: i32): string => {
  let last = "";
  for (let r = 0; r < rounds; r++) {
    for (const w of words(r + 1)) {
      last = w;
    }
  }
  return last;
};

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy${i}`.length;
  }
  return t;
};

export const main = (): void => {
  const m = Arena.mark();
  const before = Arena.used();
  const a = letters(5).n;
  const small = Arena.used() - before;
  Arena.release(m);
  const m2 = Arena.mark();
  const before2 = Arena.used();
  const b = letters(500).n;
  const large = Arena.used() - before2;
  Arena.release(m2);
  console.log(`${a} ${b} ${small === large ? "flat" : "grows"}`);
  const ws = words(40);
  const best = longest(ws);
  const last = lastWord(30);
  console.log(`${churn()}`);
  console.log(`${best} ${last}`);
};
