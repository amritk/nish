// WP18 G8: type arguments are not written at a method call through a field
// path either — `this.h.get<i32>(7)` is `(this.h.get < i32) > (7)` to a
// one-token parser, and gets the call-site rule rather than a remark about a
// method read as a field.
class Holder {
  value: i32 = 0;

  get<T>(x: T): T {
    return x;
  }
}

class Outer {
  h: Holder;

  constructor() {
    this.h = new Holder();
  }

  run(): i32 {
    return this.h.get<i32>(7);
  }
}

export const test = (): number => new Outer().run();
