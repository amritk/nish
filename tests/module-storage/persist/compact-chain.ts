// The persist section's chain with a compact node (WP48): chain.ts with
// `Node implements Compact`, so its scratch root leaves as much garbage a push
// as the list keeps and every compaction has a region to pack. On wasm32 the
// marker keeps full-pointer links (the wasm runtime's root trace reads each
// link as a pointer), so a node is 8 bytes, as in chain.ts, and the driver's
// chain mode checks it packs to 8 bytes a node through every compaction.

import { Compact } from "nish:compact"

class Node implements Compact {
  value: i32
  next: Node | null = null

  constructor(value: i32) {
    this.value = value
  }
}

const head = new Array<Node | null>(1)
const scratch = new Array<Node | null>(1)

export const push = (value: i32): void => {
  scratch[0] = new Node(value)
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
