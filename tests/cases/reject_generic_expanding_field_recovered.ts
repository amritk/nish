// WP18 §4a: what the *rest* of the program sees after the refusal above it.
// `Nest<i32[]>` cannot be monomorphised, so the request for it is answered
// with the instantiation it grew from — `Nest<i32>`, the type the program
// would have had if `inner` had named `T` the way the sentence says to.
//
// Two fragments, and each pins half of that. The refusal is still reported;
// and the return below is still reported too, which takes both the recovery
// and the recovery's *value* — only the ancestor makes `n.inner` a
// `Nest$i32 | null` — since without them stage0 loses the field and stage1
// loses the field's type, and each says something else entirely.
class Nest<T> {
  inner: Nest<T[]> | null;
  constructor() {
    this.inner = null;
  }
}

export const test = (): number => {
  const n = new Nest<i32>();
  return n.inner;
};
