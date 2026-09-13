// A generic class is instantiated by writing its type arguments; the bare name
// is not a type, because there is no layout until `T` is bound (WP18 G5). The
// case is the old "generic classes are forbidden" one, re-pointed at the rule
// that replaced it.
class Holder<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
}

export const test = (): number => {
  const h: Holder = new Holder<i32>(1);
  return h.value;
};
