// Only the `?.` links skip a `null`: `a?.next.value` reads a field of
// `a.next`, which may be `null`, and the fix is a `?.` of its own.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null): i32 => a?.next.value ?? 0;
