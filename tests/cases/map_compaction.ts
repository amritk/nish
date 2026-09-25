// WP32 (docs/wp32-map.md §6.1): a table that churns — every insert paired with
// the delete of the key that fell out of a sliding window — reaches the load
// bound with most of its entries dead, and compacts in place at the same size
// instead of growing. 100000 inserts into a window of 64 live keys end with
// exactly the window's keys present and none of the earlier ones.
export const main = (): i32 => {
  const s = new Set<i32>();
  const window: i32 = 64;
  const n: i32 = 100000;
  for (let i: i32 = 0; i < n; i++) {
    s.add(i);
    if (i >= window) {
      s.delete(i - window);
    }
  }
  let live: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if (s.has(i)) {
      live++;
    }
  }
  console.log(`${s.size} ${live} ${s.has(n - 1)} ${s.has(n - window)} ${s.has(n - window - 1)} ${s.has(0)}`);
  return 0;
};
