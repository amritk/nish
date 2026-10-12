// A parenthesis ends a chain, as in TypeScript: `(a?.next).value` reads a
// field of what `a?.next` answers, which may be missing, so `?.next` has no
// default of its own.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null): i32 => (a?.next).value ?? 0;
