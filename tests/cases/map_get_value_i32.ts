// WP32: an `i32` value, read through `valueAt` on the found edge.
export const main = (): i32 => {
  const m = new Map<i32, i32>();
  m.set(3, -7);
  const v = m.get(3);
  const w = m.get(4);
  console.log(`${m.get(3) ?? 0} ${m.get(4) ?? 0} ${v !== undefined ? v : 0} ${w === undefined}`);
  return 0;
};
