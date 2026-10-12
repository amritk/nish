// A parameter stored in an object can be shrunk through the object: `keep`
// pops it through the holder, so it keeps no length. The read keeps its check,
// and panics.
class Holder {
  items: i32[];

  constructor() {
    this.items = [];
  }
}

const keep = (h: Holder, ys: i32[]): void => {
  h.items = ys;
  h.items.pop();
};

const held = (): i32[] => {
  const arr = new Array<i32>(4);
  keep(new Holder(), arr);
  return arr;
};

export const main = (): number => {
  const xs = held();
  console.log(`${xs[3]}`);
  return 0;
};
