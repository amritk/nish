// WP18 G5: one generic class at one type argument. The golden pins
// `%struct.Box$i32`, the `$` in the constructor and getter symbols, and the
// `dereferenceable(4)` that follows the instantiated layout rather than the
// template — this is `cls_point.ll`'s shape with the name changed, which is the
// package's acceptance claim for a class.
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
  const b = new Box<i32>(7);
  return b.get();
};
