// WP18 G8: the same refusal on a generic class, where the collision would be
// `Box$i32.pick$i32$i32` from both `pick<U1, U2>` and `pick$i32<V>` on the
// receiver `Box<i32>`.
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  pick<U1, U2>(a: U1, b: U2): i32 {
    return 3;
  }

  pick$i32<V>(v: V): i32 {
    return 9;
  }
}

export const test = (): number => {
  const b = new Box<i32>(0);
  return b.pick(1, 2) + b.pick$i32(1);
};
