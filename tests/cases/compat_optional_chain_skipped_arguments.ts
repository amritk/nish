// WP28 C1, `optional-chaining`: a call a `?.` skips does not evaluate its
// arguments either. `tick` prints, so a skipped call that still ran it would
// print a second line, as Node does not.

class Cell {
  n: i32 = 0;
  bump(by: i32): void {
    this.n += by;
  }
}

class Counter {
  calls: i32 = 0;
  tick(): i32 {
    this.calls = this.calls + 1;
    console.log(`tick ${this.calls}`);
    return this.calls;
  }
}

export const main = (): void => {
  const t = new Counter();
  const a: Cell | null = new Cell();
  const z: Cell | null = null;
  a?.bump(t.tick());
  z?.bump(t.tick());
  console.log(`${a?.n ?? -1} ${t.calls}`);
};
