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
