// `ping` and `pong` hand the array back and forth, and `pong` pops it on the
// way: a recursion taken to keep the length while it is read still finds the
// `pop`. The read keeps its check, and panics.
const ping = (ys: i32[], n: i32): void => {
  if (n > 0) {
    pong(ys, n - 1);
  }
};

const pong = (ys: i32[], n: i32): void => {
  ys.pop();
  ping(ys, n);
};

const bounced = (): i32[] => {
  const arr = new Array<i32>(4);
  ping(arr, 1);
  return arr;
};

export const main = (): number => {
  const xs = bounced();
  console.log(`${xs[3]}`);
  return 0;
};
