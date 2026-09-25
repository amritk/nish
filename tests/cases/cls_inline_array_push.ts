// Negative: `push` changes the length, and it is a method call on the field,
// so the field's array is a value and keeps the pointer layout.
class Stack {
  items: i32[];

  constructor() {
    this.items = [1, 2];
  }

  add(v: i32): void {
    this.items.push(v);
  }
}

export const main = (): number => {
  const s = new Stack();
  s.add(3);
  s.add(4);
  console.log(`${s.items.length} ${s.items[3]}`);
  return 0;
};
