// Go twin of treesum.ts: the same tree, the same two walks, the same lines.
// Go's integers wrap on overflow where Nish's panic; no sum here overflows.
package main

import (
	"fmt"
	"math/bits"
	"os"
)

const DEPTH = 20 // bench:n
const PASSES = 60

type TreeNode struct {
	value int32
	left  *TreeNode
	right *TreeNode
}

// The method kernel: TreeNode.sum() in treesum.ts.
func (t *TreeNode) sum() int32 {
	left := t.left
	right := t.right
	var l int32
	if left != nil {
		l = left.sum()
	}
	if right == nil {
		return t.value + l
	}
	return t.value + l + right.sum()
}

// The fn kernel: sum in treesum.ts.
func sum(t *TreeNode) int32 {
	if t == nil {
		return 0
	}
	return t.value + sum(t.left) + sum(t.right)
}

func build(depth int32, id int32) *TreeNode {
	var left, right *TreeNode
	if depth > 1 {
		left = build(depth-1, id*2)
		right = build(depth-1, id*2+1)
	}
	return &TreeNode{value: id & 1023, left: left, right: right}
}

func main() {
	only := ""
	if len(os.Args) > 1 {
		only = os.Args[1]
	}
	root := build(DEPTH, 1)

	if only == "" || only == "fn" {
		var h int32
		for pass := int32(0); pass < PASSES; pass++ {
			root.value = pass
			h = int32(bits.RotateLeft32(uint32(h), 5)) ^ sum(root)
		}
		fmt.Printf("fn %d\n", h)
	}
	if only == "" || only == "method" {
		var h int32
		for pass := int32(0); pass < PASSES; pass++ {
			root.value = pass
			h = int32(bits.RotateLeft32(uint32(h), 5)) ^ root.sum()
		}
		fmt.Printf("method %d\n", h)
	}
}
