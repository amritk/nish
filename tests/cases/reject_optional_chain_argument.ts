// An argument is an expression of its own: `b?.value` inside the call needs a
// `??` of its own, whatever the outer chain ends in.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null, b: Node | null): i32 => a?.take(b?.value) ?? 0;
