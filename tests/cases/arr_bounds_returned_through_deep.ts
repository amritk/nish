// The array passes through `relay` to `drop`, which pops it: a parameter keeps
// its length only when every function it is handed on to keeps it too. The
// read keeps its check, and panics.
const drop = (ys: i32[]): void => {
  ys.pop();
};

const relay = (ys: i32[]): void => {
  ys[0] = 1;
  drop(ys);
};

const relayed = (): i32[] => {
  const arr = new Array<i32>(4);
  relay(arr);
  return arr;
};

export const main = (): number => {
  const xs = relayed();
  console.log(`${xs[3]}`);
  return 0;
};
