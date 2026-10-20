// NL2556: A `??` whose left side is a field of type `Counter | null` gives its fallback the class as contextual type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
class Holder {
  c: Counter | null;
  constructor() {
    this.c = null;
  }
}
export const main = (): i32 => {
  const h = new Holder();
  const d = h.c ?? { n: 5 };
  return d.get();
};
