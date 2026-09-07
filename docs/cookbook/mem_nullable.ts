class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

function valueOr(n: Node | null, fallback: number): number {
  return n !== null ? n.value : fallback;
}

function sum(head: Node | null): number {
  let total = 0;
  let cur: Node | null = head;
  while (cur !== null) {
    total += cur.value;
    cur = cur.next;
  }
  return total;
}

// `(Node | null)[]`, which is where a type needs its parentheses: `Node |
// null[]` would group the other way. The element loads as a nullable and
// narrows like any local once it is bound to one.
function firstValue(slots: (Node | null)[]): number {
  const head = slots[0];
  return head !== null ? head.value : 0;
}
