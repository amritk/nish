// A helper that hands its array to another function gives no length: the
// callee may shrink it, as `drop` does. The read keeps its check, and panics.
const drop = (ys: i32[]): void => {
  ys.pop();
};

const handed = (): i32[] => {
  const arr = new Array<i32>(4);
  drop(arr);
  return arr;
};

export const main = (): number => {
  const xs = handed();
  console.log(`${xs[3]}`);
  return 0;
};
