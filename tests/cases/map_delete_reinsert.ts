// WP32 (docs/wp32-map.md §6.1): `delete` leaves a tombstone that a probe walks
// past, so a key filed after a deleted one in the same probe chain is still
// found; setting a deleted key again appends a new entry at the end, as
// JavaScript's `Map` puts it back in insertion order last. The keys all share
// the bucket they start from in a table of eight, which is what makes the
// chain.
export const main = (): i32 => {
  const m = new Map<i32, i32>();
  for (let i: i32 = 0; i < 5; i++) {
    m.set(i * 8, i);
  }
  const first = m.delete(0);
  const middle = m.delete(16);
  const chain = m.has(8) && m.has(24) && m.has(32);
  m.set(0, 100);
  console.log(`${first} ${middle} ${chain} ${m.has(0)} ${m.has(16)} ${m.size}`);
  m.clear();
  console.log(`${m.size} ${m.has(8)} ${m.has(0)}`);
  m.set(8, 1).set(8, 2);
  console.log(`${m.size} ${m.has(8)}`);
  return 0;
};
