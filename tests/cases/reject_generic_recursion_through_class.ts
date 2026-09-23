// WP18 §4 with the chain running through a class: the recursive call wraps `T`
// in `Box<T>`, so `grow<i32>` needs `grow<Box<i32>>` needs
// `grow<Box<Box<i32>>>`. The refusal names each step the way it was written
// (`Box<i32>`, not the `Box$i32` symbol), which is WP18 G8's display rule
// reaching a diagnostic.
class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

const grow = <T>(x: T, n: i32): i32 => {
  if (n === 0) {
    return 0;
  }
  return grow(new Box<T>(x), n - 1);
};

export const test = (): number => grow(1, 3);
