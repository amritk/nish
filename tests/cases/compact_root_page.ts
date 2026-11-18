// WP48: a compact class reached from root storage in a wasm32 build (the
// `.args` pass `--target wasm32`). The wasm runtime's root trace reads each
// link as a pointer, so the class keeps full-pointer links there and the
// descriptor is the one an unmarked class gets.

import { Compact } from "nish:compact"

class Node implements Compact {
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
