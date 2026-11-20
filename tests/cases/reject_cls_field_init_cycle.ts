// Each `Node` would construct another `Node` before its constructor ran, and
// that one another: initializers that construct their own class never end.
class Node {
  value: i32 = 0;
  next: Node | null = new Node();
}

export const main = (): i32 => new Node().value;
