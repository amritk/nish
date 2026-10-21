// NL2556: The fallback of `??` after a `Map` `get` stands in for the missing value, so it takes the map's value class, `Counter`, as its contextual type. A class with methods is made only by `new`.
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
  const d = m.get("a") ?? { n: 5 };
  return d.get();
};
