class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

function walk(head: Node | null): number {
  let cur = head;
  let total = 0;
  if (cur !== null) {
    while (total < 10) {
      total += cur.value;
      cur = cur.next;
    }
  }
  return total;
}
