// WP18 G8: `$` separates a generic's name from its type arguments in a symbol
// (§3c), so a method called `pick$i32` beside a generic `pick` would be the
// symbol `pick<i32>` is minted as. Refused where that can happen: the part of
// the name before the `$` is a generic method of the same class.
class Holder {
  value: i32 = 0;

  pick<T>(a: T): T {
    return a;
  }

  pick$i32(a: i32): i32 {
    return a + 1;
  }
}

export const test = (): number => new Holder().pick(1);
