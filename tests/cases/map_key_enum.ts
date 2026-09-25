// WP32 (docs/wp32-map.md §5.2): an enum key is its `i32`, hashed with `fmix32`,
// and the map's type keeps the enum distinct from `i32`.
enum Fruit {
  Apple = 1,
  Pear = 2,
  Plum = 40,
}

export const main = (): i32 => {
  const m = new Map<Fruit, i32>();
  m.set(Fruit.Apple, 3).set(Fruit.Plum, 5);
  const gone = m.delete(Fruit.Apple);
  console.log(`${m.size} ${gone} ${m.has(Fruit.Apple)} ${m.has(Fruit.Pear)} ${m.has(Fruit.Plum)}`);
  return 0;
};
