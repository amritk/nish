// `fill` inside `relay` is its function parameter, not the module's `fill`
// that keeps the length, and `relay(shrink, arr)` runs `shrink`, which pops.
// `relay` takes a function parameter, so its call runs an instantiation, which
// the rule never reads by name; were it read, the name check refuses a call
// whose name is the body's own parameter. The read keeps its check, and
// panics.
const fill = (ys: i32[]): void => {
  ys[0] = 1;
};

const shrink = (ys: i32[]): void => {
  ys.pop();
};

const relay = (fill: (ys: i32[]) => void, ys: i32[]): void => {
  fill(ys);
};

const built = (): i32[] => {
  const arr = new Array<i32>(4);
  relay(shrink, arr);
  return arr;
};

export const main = (): number => {
  fill([0]);
  const xs = built();
  console.log(`${xs[3]}`);
  return 0;
};
