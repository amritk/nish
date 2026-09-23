// WP18 G8: `checkImplements` names both sides the way they were written. A
// `Box<i32>` whose first field is not `Container<i32>`'s is refused as
// `Box<i32>` and `Container<i32>`, never as the `Box$i32` / `Container$i32`
// symbols they are laid out under.
interface Container<T> {
  value: T;
}

class Box<T> implements Container<T> {
  other: i32;
  value: T;
  constructor(value: T) {
    this.other = 0;
    this.value = value;
  }
}

export const test = (): number => {
  const b = new Box<i32>(1);
  return b.value;
};
