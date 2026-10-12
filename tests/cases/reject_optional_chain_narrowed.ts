// Inside `a !== null` the receiver is narrowed to `Node`, so the `?.` there has
// nothing to skip either.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null): i32 => {
  if (a !== null) {
    return a?.value ?? 0;
  }
  return -1;
};
