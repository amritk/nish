// `?.` on the left of an assignment, which TypeScript refuses too: there is
// nothing to assign to where `a` is `null`.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node | null): i32 => {
  a?.value = 2;
  return 0;
};
