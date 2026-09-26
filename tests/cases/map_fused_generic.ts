// WP32 S5 (docs/wp32-map.md §9.1): fusion inside generic code. The update in
// `tally<K>` and the guarded insert in `Uniq<T>.push` are each one probe in
// every instantiation, recorded per instance as every side table is.
const tally = <K>(counts: Map<K, number>, key: K): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

class Uniq<T> {
  seen: Set<T>;
  order: T[];

  constructor() {
    this.seen = new Set<T>();
    this.order = [];
  }

  push(x: T): void {
    if (!this.seen.has(x)) {
      this.seen.add(x);
      this.order.push(x);
    }
  }
}

export const main = (): i32 => {
  const byWord = new Map<string, number>();
  const byLength = new Map<number, number>();
  const words = new Uniq<string>();
  for (const w of ["to", "be", "or", "not", "to", "be"]) {
    tally(byWord, w);
    tally(byLength, w.length);
    words.push(w);
  }
  console.log(`${byWord.get("to") ?? -1} ${byWord.get("not") ?? -1} ${byLength.get(2) ?? -1} ${byLength.get(3) ?? -1}`);
  console.log(`${words.order.length} ${words.order[3]}`);
  return 0;
};
