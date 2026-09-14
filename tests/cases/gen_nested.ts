// `Box<Box<i32>>`: the lexer merges `>>` and `expectTypeArgumentEnd` splits it
// again, and the mangling recurses, so the inner instantiation is requested
// while the outer one's arguments are still being resolved.
class Box<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
  get(): T {
    return this.value;
  }
}

export const test = (): number => {
  const inner = new Box<i32>(21);
  const outer = new Box<Box<i32>>(inner);
  return outer.get().get() * 2;
};
