// The struct half of the termination rule (WP18 §4): a field whose type puts
// the class's own type argument under a constructor asks for a strictly larger
// instantiation, and the chain has no end. `Nest<T>` would be fine.
class Nest<T> {
  inner: Nest<T[]> | null;
  constructor() {
    this.inner = null;
  }
}

export const test = (): number => {
  const n = new Nest<i32>();
  return n.inner === null ? 0 : 1;
};
