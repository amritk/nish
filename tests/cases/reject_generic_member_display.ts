// WP18 G8: the member rules name an instantiated class or interface the way it
// was written. An unknown field, a method argument of the wrong type and an
// object-literal field of the wrong type each say `Box<i32>` or `Pair<i32>`,
// and the method is `Box<i32>.set`, never the mangled `Box$i32` symbol.
interface Pair<T> {
  first: T;
  second: T;
}

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  set(value: T): void {
    this.value = value;
  }
}

export const test = (): number => {
  const b = new Box<i32>(1);
  const n = b.nope;
  b.set("oops");
  const p: Pair<i32> = { first: 1, second: "two" };
  return p.first;
};
