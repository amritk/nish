// The negatives of `mem_return_array_scope` in the caller: an array returned
// by a function that filled it with fresh strings holds them, so whatever the
// caller reads out of it is as new as the call, and is followed as the call
// is. Kept in a local declared outside the loop, in a field, through a
// function that hands an element back, through `pop` (a one-hole template is
// the popped string itself), from a `for...of` variable, or through a
// function that returns the array on, the string outlives the pass, so the
// pass keeps what it allocated; `rows` pushes arrays, which escape as before
// (`mem_return_array_nested`). Each kept string reads back intact after
// `churn` has reused every byte a wrong release would have freed.
class Log {
  first: string;

  constructor() {
    this.first = "";
  }
}

const words = (i: i32): string[] => {
  const xs: string[] = [];
  xs.push(`word ${i}`);
  xs.push(`next ${i}`);
  return xs;
};

const rows = (i: i32): string[][] => {
  const out: string[][] = [];
  out.push(words(i));
  return out;
};

const wrapped = (i: i32): string[] => words(i);

const firstOf = (xs: string[]): string => xs[0];

const firstWord = (i: i32): string => {
  const ws = words(i);
  return ws[0];
};

export const main = (): void => {
  const log = new Log();
  let kept = "";
  let viaCall = "";
  let popped = "";
  let nested = "";
  let walked = "";
  let wrap = "";
  let returned = "";
  for (let i = 0; i < 1000; i++) {
    kept = words(i)[0];
  }
  for (let i = 0; i < 1000; i++) {
    log.first = words(i)[1];
  }
  for (let i = 0; i < 1000; i++) {
    viaCall = firstOf(words(i));
  }
  for (let i = 0; i < 1000; i++) {
    const ws = words(i);
    popped = `${ws.pop()}`;
  }
  for (let i = 0; i < 1000; i++) {
    nested = rows(i)[0][1];
  }
  for (let i = 0; i < 1000; i++) {
    for (const w of words(i)) {
      walked = w;
    }
  }
  for (let i = 0; i < 1000; i++) {
    wrap = wrapped(i)[0];
  }
  returned = firstWord(999);
  console.log(`${churn()}`);
  console.log(kept);
  console.log(log.first);
  console.log(viaCall);
  console.log(popped);
  console.log(nested);
  console.log(walked);
  console.log(wrap);
  console.log(returned);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length;
  }
  return t;
};
