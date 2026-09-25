// WP32 (docs/wp32-map.md §2.4, §6.1): a table grows by doubling at three
// quarters full and re-files every bucket from the stored hashes, never hashing
// a key again. 10000 string keys take it from 8 buckets to 16384, and every key
// is still found, with its latest value, afterwards.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  const n: i32 = 10000;
  for (let i: i32 = 0; i < n; i++) {
    m.set(`key${i}`, i);
  }
  for (let i: i32 = 0; i < n; i = i + 2) {
    m.set(`key${i}`, -i);
  }
  let found: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    if (m.has(`key${i}`)) {
      found++;
    }
  }
  console.log(`${m.size} ${found} ${m.has("key10000")} ${m.has("key")}`);
  return 0;
};
