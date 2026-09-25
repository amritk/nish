// WP32 (docs/wp32-map.md §5.2): an `i64` key hashes through `fmix64`, folded to 32 bits, so keys that differ only above bit 31 are distinct.
// Each key is set, found, overwritten and deleted once, and a deleted key is absent.
export const main = (): i32 => {
  const k0: i64 = -1;
  const k1: i64 = 0;
  const k2: i64 = 4294967296;
  const k3: i64 = 1099511627776;
  const k4: i64 = -4294967296;
  const m = new Map<i64, i32>();
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
