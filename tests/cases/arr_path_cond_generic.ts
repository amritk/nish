// The same `&&` shape inside a generic class: an instantiation is a body like
// any other, and `this.items` a path like any other. Run by tests/run.js:
// exit 1 with "index out of range: 5 >= 1".
class Box<T> {
  items: T[];
  constructor(items: T[]) {
    this.items = items;
  }

  trim(): boolean {
    while (this.items.length > 1) {
      this.items.pop();
    }
    return true;
  }

  take(i: i32): T {
    if (i >= 0 && i < this.items.length && this.trim()) {
      return this.items[i];
    }
    return this.items[0];
  }
}

export const main = (): number => {
  const b = new Box<i32>([10, 20, 30, 40, 50, 60]);
  console.log(`${b.take(5)}`);
  return 0;
};
