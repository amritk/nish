class Node {
  value: i32
  next: Node | null = null

  constructor(value: i32) {
    this.value = value
  }
}

// A literal or a name as the default: one `select`, nothing branches.
export const nameOr = (name: string | null): string => name ?? "anonymous"

// A default with an effect runs only where the value is `null`: a branch to
// `nullish.default` and a `phi`, the blocks a written-out test makes.
export const nextOrNew = (n: Node): Node => n.next ?? new Node(0)

// The field is read once and tested, so the property path needs no local.
export const last = (head: Node): Node => {
  let cur = head
  while (cur.next !== null) {
    cur = cur.next ?? cur
  }
  return cur
}
