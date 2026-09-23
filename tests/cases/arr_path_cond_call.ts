// A later `&&` operand's call kills an earlier operand's path fact. The
// condition proves `i < this.items.length`, then `trim` pops the array to one
// element, and the body reads `this.items[i]`. The walk applied the pop, but
// the condition's facts were then added back from the syntax, so the read was
// proven and went past `len`. Run by tests/run.js: exit 1 with
// "index out of range: 5 >= 1".
class Queue {
  items: i32[];
  constructor(items: i32[]) {
    this.items = items;
  }

  trim(): boolean {
    while (this.items.length > 1) {
      this.items.pop();
    }
    return true;
  }

  take(i: i32): i32 {
    if (i >= 0 && i < this.items.length && this.trim()) {
      return this.items[i];
    }
    return -1;
  }
}

export const main = (): number => {
  const q = new Queue([10, 20, 30, 40, 50, 60]);
  console.log(`${q.take(5)}`);
  return 0;
};
