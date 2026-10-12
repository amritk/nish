// `?.[i]` stays refused: an index after `?.` would bring the default past the
// end of the array, where Node answers it and the bounds check panics.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (xs: i32[] | null): i32 => xs?.[0] ?? 0;
