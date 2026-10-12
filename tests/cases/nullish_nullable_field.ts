// `n.next ?? n` reads the field once and defaults it, so a nullable property
// path needs no copy into a local: a field never narrows, but `??` does not
// narrow it, it tests the value it read.
class Node {
  value: i32;
  next: Node | null = null;
  constructor(value: i32) {
    this.value = value;
  }
}

const last = (head: Node): Node => {
  let cur = head;
  for (let i = 0; i < 10; i++) {
    cur = cur.next ?? cur;
  }
  return cur;
};

export const main = (): i32 => {
  const head = new Node(1);
  head.next = new Node(2);
  const second = head.next ?? head;
  second.next = new Node(3);
  console.log(`${last(head).value} ${(second.next ?? head).value} ${(head.next ?? second).value}`);
  return 0;
};
