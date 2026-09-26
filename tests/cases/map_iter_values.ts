// WP32 (docs/wp32-map.md §6.2): `for (const v of m.values())` walks the values
// in the order their keys were first inserted, skipping deleted entries and
// reading a value set again in place.
export const main = (): i32 => {
  const m = new Map<number, number>();
  for (let i = 0; i < 6; i++) {
    m.set(i, i * i);
  }
  m.delete(0);
  m.delete(4);
  m.set(2, 200);
  m.set(0, 7);
  let sum = 0;
  for (const v of m.values()) {
    console.log(`${v}`);
    sum += v;
  }
  console.log(`sum ${sum}`);
  return 0;
};
