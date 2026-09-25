// WP32: a module's own `Map` shadows the global, as it does under `tsc`, so its
// `get` is its own method, answering what its signature says; no `V | undefined`.
class Map<K, V> {
  key: K;
  value: V;
  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
  get(key: K): V {
    return this.value;
  }
}

export const main = (): i32 => {
  const m = new Map<string, i32>("a", 4);
  const v: i32 = m.get("b");
  console.log(`${v + 1}`);
  return 0;
};
