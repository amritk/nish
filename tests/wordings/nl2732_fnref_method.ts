// NL2732: a method named as a value. A reference names a top-level function,
// and a method needs the receiver it was named through.
class Counter {
  n: i32 = 0;
  bump(by: i32): i32 {
    this.n = this.n + by;
    return this.n;
  }
}

export const main = (): i32 => {
  const c = new Counter();
  const f = c.bump;
  return 0;
};
