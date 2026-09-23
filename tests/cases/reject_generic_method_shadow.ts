// WP18 G8: a class's type parameters are in scope in its methods, so a method
// that declares one of the same name would make every `T` in its body, its
// constraints and its diagnostics ambiguous. TypeScript lets the inner one
// shadow the outer; this language refuses it, once per class, in NL2302's
// spirit. Two classes, each instantiated twice, are exactly `2 errors`.
class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  map<T>(other: T): T {
    return other;
  }
}

class Cell<K> {
  key: K;

  constructor(key: K) {
    this.key = key;
  }

  swap<V, K>(v: V, k: K): K {
    return k;
  }
}

export const test = (): number => {
  const a = new Box<i32>(1);
  const b = new Box<string>("b");
  const c = new Cell<i32>(2);
  const d = new Cell<boolean>(true);
  return a.value + b.value.length + c.key + (d.key ? 1 : 0);
};
