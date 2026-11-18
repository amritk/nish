// The persist section's chain: one list grown a node a call to 200,000 nodes,
// which every compaction traces end to end. Each push also puts a scratch
// node in a second root, dropping the one before it, so a call leaves as much
// garbage as it keeps and a compaction has half the region to pack away: on
// wasm32 a node is 8 bytes (an i32 and a 4-byte pointer), so the kept heap
// grows 16 bytes a push and each compaction packs it back to 8 a node, plus
// the one scratch node still kept.

class Node {
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
