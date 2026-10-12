// `first()` asks whether `drain` keeps its array's length. Reading it follows
// `pass`, which hands the array back to `drain`, still being read, so `pass`
// is answered on an assumption — and `drain` then pops. That answer is not
// remembered: `second()` asks about `pass` again from the start, and finds the
// `pop`. The read keeps its check, and panics.
const drain = (ys: i32[], n: i32): void => {
  if (n > 0) {
    pass(ys, n - 1);
  }
  ys.pop();
};

const pass = (ys: i32[], n: i32): void => {
  drain(ys, n);
};

const first = (): i32[] => {
  const arr = new Array<i32>(4);
  drain(arr, 1);
  return arr;
};

const second = (): i32[] => {
  const arr = new Array<i32>(4);
  pass(arr, 1);
  return arr;
};

export const main = (): number => {
  const a = first();
  const b = second();
  console.log(`${a.length}`);
  console.log(`${b[3]}`);
  return 0;
};
