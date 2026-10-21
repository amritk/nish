// NL2556: A ternary fallback of `??` that may answer `null` takes `Counter | null` as its contextual type, and each branch takes it in turn. A class with methods is made only by `new`.
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
  const c: Counter | null = null;
  const b = true;
  const d = c ?? (b ? { n: 5 } : null);
  return d === null ? 0 : d.get();
};
