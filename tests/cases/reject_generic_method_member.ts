// WP18 G8 (§15.6 applied to a method): an unconstrained method type parameter
// has no members, so `u.area` is refused even though every `U` this program
// asks for happens to have one. The fix is the constraint the message names.
class Point {
  area: i32 = 1;
}

class Scale {
  factor: i32 = 2;

  apply<U>(u: U): i32 {
    return u.area * this.factor;
  }
}

export const test = (): number => new Scale().apply(new Point());
