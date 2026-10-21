// NL2556: The target is a generic class with methods, instantiated at a number. A class with methods is made only by `new`.
class Box<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
  get(): T {
    return this.v;
  }
}
export const main = (): i32 => {
  const b: Box<i32> = { v: 1 };
  return b.get();
};
