// WP18 G8: with `-g` an instantiation of a generic method is named as written
// and linked as mangled, like an instantiated class's method (§6.7).
// `Box<i32>.pair<string>` and `Box<i32>.pair<i32>` are two `DISubprogram`s
// with distinct `linkageName`s (`Box$i32.pair$str`, `Box$i32.pair$i32`) and the
// same `line`, the method's.
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  pair<U>(other: U): T {
    const kept: U = other;
    return this.value;
  }
}

export const test = (): number => {
  const b = new Box<i32>(40);
  return b.pair("two") + b.pair(2);
};
