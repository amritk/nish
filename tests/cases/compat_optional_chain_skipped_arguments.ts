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

// The receivers are parameters, so neither dialect nor tsc knows which one is
// missing.
const both = (t: Counter, a: Cell | null, z: Cell | null): void => {
  a?.bump(t.tick());
  z?.bump(t.tick());
  console.log(`${a?.n ?? -1} ${t.calls}`);
};

export const main = (): void => {
  both(new Counter(), new Cell(), null);
};
