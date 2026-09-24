// A second generic `Box`, instantiated at `i32` by a signature, as `main.ts`'s is.
class Box<T> {
  v: T;

  constructor(v: T) {
    this.v = v;
  }

  get(): T {
    return this.v;
  }
}

export const fa = (b: Box<i32>): i32 => b.get();
export const ma = (): Box<i32> => new Box<i32>(1);
