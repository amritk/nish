// WP55: root storage on a page module. Each root's address and the type
// descriptors of every class it reaches are emitted, and the loader keeps the
// graph through `nish_root_keep` after each export call.

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

export const total = (): i32 => {
  let sum = 0
  let n = head[0]
  while (n !== null) {
    sum = sum + n.value
    n = n.next
  }
  return sum
}
