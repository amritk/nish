// WP32 (docs/wp32-map.md §6.2, §6.3): a walk in a generic function or a
// generic class's method is checked per instantiation, so a `Set<T>` or a
// `Map<T, V>` field walks as the concrete table it is, parentheses around the
// iterable or not.
const count = <T>(s: Set<T>): number => {
  let n = 0;
  for (const x of s) {
    n++;
  }
  return n;
};

class Bag<T> {
  items: Map<T, number>;

  constructor() {
    this.items = new Map<T, number>();
  }

  total(): number {
    let t = 0;
    for (const v of this.items.values()) {
      t += v;
    }
    for (const k of (this.items.keys())) {
      t += 1;
    }
    return t;
  }
}

export const main = (): i32 => {
  const s = new Set<string>();
  s.add("a").add("b");
  const b = new Bag<number>();
  b.items.set(1, 5).set(2, 6);
  console.log(`${count(s)} ${count(new Set<number>())} ${b.total()}`);
  return 0;
};
