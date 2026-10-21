// NL2556: `Map.set` hands the map's value type to its argument. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
export const main = (): i32 => {
  const m = new Map<string, Counter>();
  m.set("a", { n: 5 });
  const c = m.get("a");
  if (c !== null) {
    return c.get();
  }
  return 0;
};
