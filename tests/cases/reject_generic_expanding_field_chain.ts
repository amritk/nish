// WP18 §4: the chain the rule walks is the whole ancestry, not the immediate
// parent. `A<i32>` lays out a `B<i32>`, which lays out a `C<i32>`, whose own
// field asks for `A<i32[]>` — three links up. The sentence names `A<i32>` and
// `A<i32[]>`, the two ends of the cycle, rather than whichever struct happened
// to hold the annotation.
class A<T> {
  b: B<T> | null;
  constructor() {
    this.b = null;
  }
}

class B<U> {
  c: C<U> | null;
  constructor() {
    this.c = null;
  }
}

class C<V> {
  a: A<V[]> | null;
  constructor() {
    this.a = null;
  }
}

export const test = (): number => {
  const start = new A<i32>();
  return start.b === null ? 0 : 1;
};
