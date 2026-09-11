// Nish has no inheritance (WP25). The message names the rewrite: repeat the
// base's fields as the first fields of the class and convert through an
// interface instead.
class Base {
  x: number = 0;
}

class Derived extends Base {
  y: number = 1;
}

export function test(): number {
  return new Derived().y;
}
