// A tree sum over class nodes: `(t.value + sum(t.left)) + sum(t.right)` is a
// step whose `X` is the value and the left subtree, so the walk down the
// right spine is a loop and only the left subtrees are calls.
class TreeNode {
  value: i32
  left: TreeNode | null
  right: TreeNode | null
  constructor(value: i32, left: TreeNode | null, right: TreeNode | null) {
    this.value = value
    this.left = left
    this.right = right
  }
}

const sum = (t: TreeNode | null): i32 => {
  if (t === null) {
    return 0
  }
  return t.value + sum(t.left) + sum(t.right)
}

/** A complete tree of `depth` levels, its values numbered from `first`. */
const build = (depth: i32, first: i32): TreeNode | null => {
  if (depth === 0) {
    return null
  }
  return new TreeNode(first, build(depth - 1, first * 2), build(depth - 1, first * 2 + 1))
}

export const main = (): i32 => {
  const spine = new TreeNode(1, null, new TreeNode(-2, new TreeNode(30, null, null), new TreeNode(4, null, null)))
  console.log(`${sum(null)} ${sum(spine)} ${sum(build(10, 1))}`)
  return 0
}
