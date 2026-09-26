// WP32 (docs/wp32-map.md §6.2): a walk inside a function called from a walk of
// the same table is counted as a second walk and closed on its own edges. The
// callee's churn during both walks moves no entry, and when both are over the
// table compacts again.

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

const sumAndGrow = (m: Map<number, number>, extra: number): number => {
  let sum = 0;
  for (const v of m.values()) {
    sum += v;
    m.delete(extra - 10);
    m.set(extra, extra);
  }
  return sum;
};

export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 0; i < 5; i++) {
    m.set(i, 1);
  }
  let extra = 20;
  for (const k of m.keys()) {
    if (k < 3) {
      console.log(`${k} ${sumAndGrow(m, extra)}`);
      extra++;
    }
  }
  console.log(`size ${m.size} flat ${churnsFlat(m)}`);
  return 0;
};
