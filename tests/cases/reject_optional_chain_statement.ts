// A `?.` chain that is a statement of its own has no `??` default, so strict
// refuses it; `--compat=optional-chaining` admits it with Node's meaning: the
// call runs when `c` is not null and nothing happens when it is.
class Counter {
  n: number = 0;
  bump(by: number): void {
    this.n += by;
  }
}

export const main = (): void => {
  const a: Counter | null = new Counter();
  const b: Counter | null = null;
  a?.bump(2);
  b?.bump(3);
  console.log(`bump ${a === null ? -1 : a.n}`);
};
