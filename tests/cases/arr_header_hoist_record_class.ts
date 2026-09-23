// #180's rule, narrowed: an element store into an array of *classes* stores a
// pointer and rewrites no object, so it does not stop the header hoist. The
// loop below writes `this.nodes[i % n]` on every pass, and both `this.src` and
// `this.nodes` still have their headers lifted into the preheader, as they were
// before #180. `arr_header_hoist_record_store` is the inline-record store that
// must not hoist.
class Node {
  v: i32;
  constructor(v: i32) {
    this.v = v;
  }
}

class Grid {
  nodes: Node[];
  src: i32[];
  spare: Node;
  constructor(nodes: Node[], src: i32[], spare: Node) {
    this.nodes = nodes;
    this.src = src;
    this.spare = spare;
  }

  sumAndStamp(): i32 {
    let t: i32 = 0;
    const n: i32 = this.nodes.length;
    for (let i: i32 = 0; i < this.src.length; i = i + 1) {
      t = t + this.src[i];
      this.nodes[i % n] = this.spare;
    }
    return t;
  }
}

export const main = (): number => {
  const g = new Grid([new Node(1), new Node(2)], [10, 20, 30, 40, 50], new Node(9));
  console.log(`${g.sumAndStamp()} ${g.nodes[0].v} ${g.nodes[1].v}`);
  return 0;
};
