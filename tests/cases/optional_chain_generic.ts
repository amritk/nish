// A chain in a generic function is checked and lowered once per
// instantiation, a class `T` and a string `T` alike.
class Box<T> {
  item: T;
  next: Box<T> | null = null;
  constructor(item: T) {
    this.item = item;
  }
}

const nextItem = <T>(b: Box<T> | null, fallback: T): T => b?.next?.item ?? fallback;

const noBox = (): Box<string> | null => null;

export const main = (): i32 => {
  const a = new Box<i32>(1);
  a.next = new Box<i32>(2);
  const s = new Box<string>("x");
  console.log(`${nextItem(a, -1)} ${nextItem(a.next, -1)} ${nextItem(s, "none")} ${nextItem(noBox(), "nil")}`);
  return 0;
};
