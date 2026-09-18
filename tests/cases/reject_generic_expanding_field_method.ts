// WP18 §4a: the struct half of the termination rule is reachable from a method
// *body* as well as from a field, because a method of an instantiated class
// continues its class's chain. The recovery is a declaration's, so this one
// keeps the refusal's throw: `new Nest<T[]>()` is an expression whose value
// flows on, and answering it with `Nest$i32` would report a second mistake
// nobody made, against a mangled symbol nobody wrote.
//
// The `2 errors` fragment is the assertion. Without the rule that is exactly
// what fails: the statement below would report `Cannot initialize string
// variable `z` with Nest$i32` as well, and the count would be three. The
// unrelated mistake after it is there to pin the other half — per-statement
// recovery is untouched, so the refusal does not swallow the rest of the body.
class Nest<T> {
  inner: Nest<T> | null;
  constructor() {
    this.inner = null;
  }
  grow(): void {
    const z: string = new Nest<T[]>();
    const w: i32 = "not a number";
  }
}

export const test = (): number => {
  const n = new Nest<i32>();
  n.grow();
  return 0;
};
