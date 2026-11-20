// WP28 C1, `optional-chaining`: a `?.` chain that is a statement of its own.
// Each link tests for `null` the way strict's `a?.b ?? d` does, and the
// statement does nothing past the first missing link, as in Node.
class Cell {
  n: number = 0;
  next: Cell | null = null;
  bump(by: number): void {
    this.n += by;
  }
  label(): string {
    return `cell ${this.n}`;
  }
}

const touch = (c: Cell | null, by: number): void => {
  c?.bump(by);
  c?.next?.bump(by * 10);
};

export const main = (): void => {
  const a = new Cell();
  const b = new Cell();
  a.next = b;
  touch(a, 2);
  touch(null, 3);
  touch(b, 5);
  console.log(`${a.n} ${b.n}`);
  const c: Cell | null = a.next;
  console.log(c?.label() ?? "none");
  console.log(b.next?.label() ?? "none");
};
