// WP18 §8 message 8, the method-call form: `c.bump()` on an unconstrained `T`.
class Counter {
  count: i32 = 0;

  bump(): i32 {
    this.count = this.count + 1;
    return this.count;
  }
}

const bumpOf = <T>(c: T): i32 => c.bump();

export const test = (): number => bumpOf(new Counter());
