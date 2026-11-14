// Self-recursive checked sums in methods (issue #1612): a step's self call
// is `r.m(args)` on a receiver of the method's own class, and the loop
// carries the receiver as its `this`. Nish binds every method call
// statically, so `r.m` is the same body whatever `r` holds.
class TreeNode {
  value: i32
  left: TreeNode | null
  right: TreeNode | null
  constructor(value: i32, left: TreeNode | null, right: TreeNode | null) {
    this.value = value
    this.left = left
    this.right = right
  }

  // The tree-sum kernel: the left subtree is a call, the right spine a loop.
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

// A counter whose step writes a field of `this` before it recurses: the
// write runs where the recursion runs it, so the loop sees what the
// recursion saw.
class Counter {
  count: i32
  constructor() {
    this.count = 0
  }

  // 1 + 2 + ... + n, counting the steps in `count`.
  total(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    this.count = this.count + 1
    return n + this.total(n - 1)
  }

  // `self(args) + Y` with `Y` a parameter, the receiver `this`.
  twice(n: i32, k: i32): i32 {
    if (n <= 0) {
      return this.count
    }
    return this.twice(n - 1, k) + k
  }
}

// A step whose `X` is a field of `this`: `step + step + ... + step`, the
// field read on every pass as the recursion reads it.
class Stepper {
  step: i32
  constructor(step: i32) {
    this.step = step
  }

  total(n: i32): i32 {
    if (n <= 0) {
      return 0
    }
    return this.step + this.total(n - 1)
  }
}

/** A complete tree of `depth` levels, its values numbered from `first`. */
const build = (depth: i32, first: i32): TreeNode | null => {
  if (depth === 0) {
    return null
  }
  return new TreeNode(first, build(depth - 1, first * 2), build(depth - 1, first * 2 + 1))
}

export const main = (): i32 => {
  const leaf = new TreeNode(7, null, null)
  const spine = new TreeNode(1, null, new TreeNode(-2, new TreeNode(30, null, null), new TreeNode(4, null, null)))
  const tree = build(10, 1)
  const big = tree === null ? 0 : tree.sum()
  const c = new Counter()
  const t = c.total(1000)
  const s = new Stepper(3)
  console.log(`${leaf.sum()} ${spine.sum()} ${big} ${t} ${c.count} ${c.twice(5, 3)} ${s.total(4)}`)
  return 0
}
