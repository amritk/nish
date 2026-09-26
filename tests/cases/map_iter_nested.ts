// WP32 (docs/wp32-map.md §6.2): two walks of one table at once, one inside the
// other, are counted exactly: an insert in the inner walk is visited by both,
// a delete in it is skipped by both, and when both are over churn compacts.

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

export const main = (): i32 => {
  const m = new Map<number, number>();
  m.set(1, 1).set(2, 2).set(3, 3);
  for (const a of m.keys()) {
    let row = `${a}:`;
    for (const b of m.keys()) {
      row = `${row} ${b}`;
      if (a === 1 && b === 2) {
        m.set(4, 4);
        m.delete(3);
      }
    }
    console.log(row);
  }
  console.log(`flat ${churnsFlat(m)} size ${m.size}`);
  return 0;
};
