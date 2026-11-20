// A `?.[i]` that ends its chain stays refused in both dialects, unlike one
// inside a chain: past the end of the array Node answers `undefined` and
// takes the default, where the bounds check panics.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (xs: i32[] | null): i32 => xs?.[0] ?? 0;
