// WP18 G8: a method's type parameter is inferred from its arguments and from
// nothing else, exactly as a function's is, so `U` here can never be bound.
// Refused once, at the declaration, however many times `Holder` is
// instantiated: a generic class's members are collected per instantiation, and
// this is one mistake. Two classes, each instantiated twice, are exactly
// `2 errors`.
class Holder<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  make<U>(): U[] {
    return [];
  }
}

class Plain {
  count: i32 = 0;

  empty<E>(n: i32): i32 {
    return n;
  }
}

export const test = (): number => {
  const a = new Holder<i32>(1);
  const b = new Holder<string>("b");
  return a.value + b.value.length + new Plain().count;
};
