// WP32 (docs/wp32-map.md §6.2): churn during a walk — each key visited is
// deleted and a new one set — takes the table through rebuild after rebuild
// with most of its entries dead, each of which would compact it. The walk
// defers compaction, so no entry moves under the cursor and the walk visits
// exactly what JavaScript's does. Once the walk is over the next rebuild
// compacts in place, so the same churn afterwards allocates nothing.
const churn = (m: Map<number, number>, from: number, count: number): void => {
  for (let i = from; i < from + count; i++) {
    m.delete(i - 16);
    m.set(i, i);
  }
};

export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 0; i < 16; i++) {
    m.set(i, i);
  }
  let next = 16;
  let visited = 0;
  let order = 0;
  for (const k of m.keys()) {
    visited++;
    order = (order * 31 + k) % 1000003;
    if (next < 4000) {
      m.delete(k);
      m.set(next, next);
      next++;
    }
  }
  console.log(`visited ${visited} order ${order} size ${m.size}`);
  churn(m, 4000, 20000);
  const before = Arena.used();
  churn(m, 24000, 40000);
  console.log(`flat ${Arena.used() === before} size ${m.size}`);
  return 0;
};
