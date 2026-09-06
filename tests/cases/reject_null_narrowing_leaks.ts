class Node {
  value: number;

  constructor(value: number) {
    this.value = value;
  }
}

function valueOf(n: Node | null): number {
  if (n !== null) {
    console.log(n.value);
  }
  return n.value;
}
