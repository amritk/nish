// `(T | null)[]` needs its parentheses: `T | null[]` groups the other way, so
// the annotation would mean "a `T`, or an array of `null`". The parenthesised
// type is transparent — the array's element type is the nullable one — and the
// golden is the `%struct.Node*` element the array header points at.
class Node {
  value: i32 = 0;
}
export function test(): number {
  const slots: (Node | null)[] = new Array<Node | null>(2);
  const first = new Node();
  first.value = 7;
  slots[0] = first;
  const found = slots[0];
  return found === null ? -1 : found.value;
}
