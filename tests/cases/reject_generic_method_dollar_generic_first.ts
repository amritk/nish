// WP18 G8: `reject_generic_method_dollar_generic` with the declarations in the
// other order, which once crashed the compiler rather than miscompiling: the
// refusal is about the `$` in the generic method's own name, so the order the
// two are declared in makes no difference.
class Holder {
  value: i32 = 0;

  pick$i32<V>(v: V): i32 {
    return 9;
  }

  pick<U1, U2>(a: U1, b: U2): i32 {
    return 3;
  }
}

export const test = (): number => {
  const h = new Holder();
  return h.pick$i32(1) + h.pick(1, 2);
};
