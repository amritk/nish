// WP18 G8: a generic method's own name is the base of every instantiation's
// symbol, so it may hold no `$`: `pick$i32<V>` at `i32` would be
// `Holder.pick$i32$i32`, which is also `pick<U1, U2>` at `i32, i32`. Refused at
// the declaration, as a generic function named `pick$i32` is.
class Holder {
  value: i32 = 0;

  pick<U1, U2>(a: U1, b: U2): i32 {
    return 3;
  }

  pick$i32<V>(v: V): i32 {
    return 9;
  }
}

export const test = (): number => {
  const h = new Holder();
  return h.pick(1, 2) + h.pick$i32(1);
};
