// `o.inner.v = refill(o)` reads `o.inner` before the call, and the call points
// `o.inner` at a new object, so the store lands in the old one. A path two links
// long names the new one, whose `v` is empty: the rule only takes a store whose
// receiver no call can rebind. The read keeps its check, and panics.
class Inner {
  v: i32[];

  constructor() {
    this.v = [];
  }
}

class Outer {
  inner: Inner;

  constructor() {
    this.inner = new Inner();
  }
}

const refill = (o: Outer): i32[] => {
  o.inner = new Inner();
  const arr = new Array<i32>(6);
  return arr;
};

export const main = (): number => {
  const o = new Outer();
  o.inner.v = refill(o);
  console.log(`${o.inner.v[5]}`);
  return 0;
};
