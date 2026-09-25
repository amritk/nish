// WP32 (docs/wp32-map.md §5.2): a `u64` key hashes through `fmix64` as an `i64` does, and 2^64 - 1 is a key.
// Each key is set, found, overwritten and deleted once, and a deleted key is absent.
export const main = (): i32 => {
  const k0: u64 = 0;
  const k1: u64 = 1;
  const k2: u64 = toU64(0) - toU64(1);
  const k3: u64 = toU64(1) << toU64(63);
  const k4: u64 = 4294967296;
  const m = new Map<u64, i32>();
  m.set(k0, 1);
  m.set(k1, 2);
  m.set(k2, 3);
  m.set(k3, 4);
  m.set(k4, 5);
  let found: i32 = 0;
  if (m.has(k0)) {
    found = found + 1;
  }
  if (m.has(k1)) {
    found = found + 1;
  }
  if (m.has(k2)) {
    found = found + 1;
  }
  if (m.has(k3)) {
    found = found + 1;
  }
  if (m.has(k4)) {
    found = found + 1;
  }
  m.set(k0, 10).set(k1, 20);
  const gone = m.delete(k2);
  const again = m.delete(k2);
  console.log(`${found} ${m.size} ${gone} ${again} ${m.has(k2)} ${m.has(k3)}`);
  return 0;
};
