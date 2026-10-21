// NL2556: A generic class instantiated at the class hands it to its constructor's argument. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
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
  const b: Box<Counter> = new Box<Counter>({ n: 5 });
  return b.get().get();
};
