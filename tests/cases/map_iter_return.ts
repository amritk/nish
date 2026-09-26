// WP32 (docs/wp32-map.md §6.2): a `return` out of a walk — here out of two
// nested walks at once — closes every walk it leaves, innermost first, so the
// table's count of live walks is back to zero and churn afterwards compacts.

// Whether churn on `m` — each insert paired with a delete — allocates nothing
// once it has warmed up: true only when its rebuilds compact, which they do
// only while no walk of `m` is still counted open.
const churnsFlat = (m: Map<number, number>): boolean => {
  for (let i = 0; i < 20000; i++) {
    m.set(100000 + i, i);
    m.delete(100000 + i);
  }
  const before = Arena.used();
  for (let i = 0; i < 40000; i++) {
    m.set(200000 + i, i);
    m.delete(200000 + i);
  }
  return Arena.used() === before;
};

const findPair = (m: Map<number, number>, total: number): number => {
  for (const a of m.keys()) {
    for (const b of m.keys()) {
      if (a < b && a + b === total) {
        return a * 100 + b;
      }
    }
  }
  return -1;
};

const firstOver = (m: Map<number, number>, limit: number): number => {
  for (const v of m.values()) {
    if (v > limit) {
      return v;
    }
  }
  return -1;
};

export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 1; i <= 9; i++) {
    m.set(i, i * i);
  }
  console.log(`pair ${findPair(m, 11)} over ${firstOver(m, 20)} none ${firstOver(m, 100)}`);
  console.log(`flat ${churnsFlat(m)} size ${m.size}`);
  return 0;
};
