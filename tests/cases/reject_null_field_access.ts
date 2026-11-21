class Node {
  value: number;
  next: Node | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

const second = (n: Node): number => {
  const next = n.next;
  return next.value;
};
