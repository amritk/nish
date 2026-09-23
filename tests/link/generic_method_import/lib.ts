// WP18 G8: a generic method of an exported class is instantiated in the class's
// module whoever calls it (§15.5, §15.8). `a.ts` and `b.ts` both ask for
// `Holder.pick<i32>` and `Box<i32>.wrap<string>`, and there is one `define` of
// each, here, and a `declare` in each caller: a compiler that answered each
// caller in its own module would emit two `define`s of one symbol, and the
// link would refuse the second.

export class Holder {
  first: boolean;

  constructor(first: boolean) {
    this.first = first;
  }

  pick<T>(a: T, b: T): T {
    return this.first ? a : b;
  }
}

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  wrap<U>(label: U): U {
    return label;
  }
}
