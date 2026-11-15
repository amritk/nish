// A tree sum two ways (bench/README.md): one complete tree of class nodes,
// summed PASSES times by a free function (`fn`) and by a method (`method`).
//
//   treesum [kernel]
//
// With no argument both kernels run and print `<kernel> <checksum>`; naming a
// kernel runs it alone, so that the harness times each in a process of its own.
//
// `fn` is the program docs/wp9-optimisation.md measured under "Self-recursive
// checked sums as a loop": `return t.value + sum(t.left) + sum(t.right)`.
// `method` is `TreeNode.sum()`, the same walk with the null tests on the
// children. Each pass first sets the root's value to the pass number, so no
// pass is the one before it again; the checksum folds every pass's sum into
// `h` by rotating it left five bits and xoring the sum in. A node's value is its heap number masked to ten bits, so every sum
// stays inside `i32`.
//
// The twins, treesum.c, treesum.go and treesum.rs, build the same tree in the
// same order, run the same walks and print the same lines.
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

const sum = (t: TreeNode | null): i32 => {
  if (t === null) {
    return 0
  }
  return t.value + sum(t.left) + sum(t.right)
}

/** A complete tree of `depth` levels; node `id`'s children are `2 * id` and `2 * id + 1`. */
const build = (depth: i32, id: i32): TreeNode => {
  const left: TreeNode | null = depth > 1 ? build(depth - 1, id * 2) : null
  const right: TreeNode | null = depth > 1 ? build(depth - 1, id * 2 + 1) : null
  return new TreeNode(id & 1023, left, right)
}

const PASSES: i32 = 60

export const main = (): i32 => {
  const DEPTH: i32 = 20 // bench:n
  const only = process.argv.length > 1 ? process.argv[1] : ""
  const root = build(DEPTH, 1)

  if (only === "" || only === "fn") {
    let h: i32 = 0
    for (let pass: i32 = 0; pass < PASSES; pass++) {
      root.value = pass
      h = ((h << 5) | (h >>> 27)) ^ sum(root)
    }
    console.log(`fn ${h}`)
  }
  if (only === "" || only === "method") {
    let h: i32 = 0
    for (let pass: i32 = 0; pass < PASSES; pass++) {
      root.value = pass
      h = ((h << 5) | (h >>> 27)) ^ root.sum()
    }
    console.log(`method ${h}`)
  }
  return 0
}
