// A header written by `pop` through an alias: `alias` and `s.items` are one
// array, so popping through the first changes the length the second reads,
// with a class-field store between every read. Both `s.items.length` reads
// have to happen, and the second answers one less.
class Stack {
  items: i32[];
  top: i32 = 0;

  constructor(items: i32[]) {
    this.items = items;
  }
}

const drop = (a: i32[], s: Stack): i32 => {
  a.pop();
  s.top = a.length;
  return s.top;
};

export const test = (): i32 => {
  const s = new Stack([4, 5, 6]);
  const alias = s.items;
  const n0 = s.items.length;
  s.top = 9;
  alias.pop();
  s.top = 8;
  const n1 = s.items.length;
  const popped = drop(alias, s);
  const n2 = s.items.length;
  return n0 * 1000 + n1 * 100 + n2 * 10 + popped - s.top + s.items[0];
};
