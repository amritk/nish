// A chain that ends in an element read is `xs[i] ?? d` again: past the end of
// the array Node answers the default where the bounds check panics.
class Holder {
  xs: i32[];
  constructor() {
    this.xs = [1];
  }
}

export const f = (h: Holder | null): i32 => h?.xs[3] ?? 0;
