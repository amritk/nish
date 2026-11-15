class Node {
  value: i32
  next: Node | null = null

  constructor(value: i32) {
    this.value = value
  }
}

const head = new Array<Node | null>(1)

export const push = (value: i32): void => {
  const n = new Node(value)
  n.next = head[0]
  head[0] = n
}
