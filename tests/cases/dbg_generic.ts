// WP18 §6.7: with `-g` an instantiation is named the way it was written and
// linked the way it was mangled, as clang does for a C++ template. `identity`
// at `i32` and `string` is two `DISubprogram`s with distinct `linkageName`s and
// the same `line` (the template's), and `Box<i32>` is a `DICompositeType` called
// `Box<i32>` whose method is `Box<i32>.get` — while `%struct.Box$i32` and every
// symbol keep the mangled spelling. `identity` at the class reads
// `identity<Box<i32>>`, the display spelling nested inside another.
const identity = <T>(x: T): T => x;

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  get(): T {
    return this.value;
  }
}

export const test = (): number => {
  const b = new Box<i32>(identity(40));
  const s: string = identity("ok");
  const c = identity(b);
  return c.get() + s.length;
};
