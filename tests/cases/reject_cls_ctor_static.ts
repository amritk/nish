// `static` on the constructor is refused like `static` on any other member, and
// the checker is what says so: the parser records the modifier and knows
// neither the class's name nor that the member is the constructor. Without the
// rule stage1 compiled this and ran the body as the *instance* constructor,
// which is the one thing `static` says it is not.
export class Counter {
  total: i32 = 0;
  static constructor() {
    this.total = 41;
  }
}
