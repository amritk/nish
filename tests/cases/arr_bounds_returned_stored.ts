// A helper that stores its array somewhere gives no length: a second holder
// can shrink it. The read keeps its check, and panics.
class Holder {
  items: i32[];

  constructor() {
    this.items = [];
  }
}

const kept = (h: Holder): i32[] => {
  const arr = new Array<i32>(4);
  h.items = arr;
  h.items.pop();
  return arr;
};

export const main = (): number => {
  const xs = kept(new Holder());
  console.log(`${xs[3]}`);
  return 0;
};
