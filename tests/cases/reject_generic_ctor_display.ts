// WP18 G8: the definite-assignment rule names an instantiated class the way it
// was written: `Box<i32>`, not the `Box$i32` symbol its constructor is emitted
// under.
class Box<T> {
  value: T;
  constructor(value: T) {}
}

export const test = (): number => {
  const b = new Box<i32>(1);
  return b.value;
};
