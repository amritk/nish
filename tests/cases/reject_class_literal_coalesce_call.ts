// NL2556: A `??` whose left side is a call returning `Counter | null` gives its fallback the class as contextual type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
const pick = (): Counter | null => null;
export const main = (): i32 => {
  const d = pick() ?? { n: 5 };
  return d.get();
};
