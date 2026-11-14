class TreeNode {
  value: i32
  left: TreeNode | null
  right: TreeNode | null
  constructor(value: i32, left: TreeNode | null, right: TreeNode | null) {
    this.value = value
    this.left = left
    this.right = right
  }

  sum(): i32 {
    const left = this.left
    const right = this.right
    const l = left === null ? 0 : left.sum()
    if (right === null) {
      return this.value + l
    }
    return this.value + l + right.sum()
  }
}

export const test = (t: TreeNode): i32 => t.sum()
