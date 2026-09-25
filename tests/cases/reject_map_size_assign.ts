// WP32 (docs/wp32-map.md §7): `size` is read-only, as it is under `tsc` (TS2540).
export const main = (): i32 => {
  const m = new Map<string, i32>();
  m.size = 3;
  return m.size;
};
