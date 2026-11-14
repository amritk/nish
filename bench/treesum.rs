// Rust twin of treesum.ts: the same tree, the same two walks, the same lines.
// Release builds wrap on overflow where Nish panics; no sum here overflows.
const DEPTH: i32 = 20; // bench:n
const PASSES: i32 = 60;

struct TreeNode {
    value: i32,
    left: Option<Box<TreeNode>>,
    right: Option<Box<TreeNode>>,
}

impl TreeNode {
    // The method kernel: TreeNode.sum() in treesum.ts.
    fn sum(&self) -> i32 {
        let left = &self.left;
        let right = &self.right;
        let l = match left {
            None => 0,
            Some(n) => n.sum(),
        };
        match right {
            None => self.value + l,
            Some(r) => self.value + l + r.sum(),
        }
    }
}

// The fn kernel: sum in treesum.ts.
fn sum(t: &Option<Box<TreeNode>>) -> i32 {
    match t {
        None => 0,
        Some(n) => n.value + sum(&n.left) + sum(&n.right),
    }
}

fn build(depth: i32, id: i32) -> Box<TreeNode> {
    let left = if depth > 1 { Some(build(depth - 1, id * 2)) } else { None };
    let right = if depth > 1 { Some(build(depth - 1, id * 2 + 1)) } else { None };
    Box::new(TreeNode { value: id & 1023, left, right })
}

fn main() {
    let only = std::env::args().nth(1).unwrap_or_default();
    let mut root = Some(build(DEPTH, 1));

    if only.is_empty() || only == "fn" {
        let mut h: i32 = 0;
        for pass in 0..PASSES {
            root.as_mut().unwrap().value = pass;
            h = h.rotate_left(5) ^ sum(&root);
        }
        println!("fn {}", h);
    }
    if only.is_empty() || only == "method" {
        let mut h: i32 = 0;
        for pass in 0..PASSES {
            root.as_mut().unwrap().value = pass;
            h = h.rotate_left(5) ^ root.as_ref().unwrap().sum();
        }
        println!("method {}", h);
    }
}
