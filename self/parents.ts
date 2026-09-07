// Parent links for stage1's whole-program analyses (docs/wp14-selfhost.md
// milestone S4).
//
// S3 deliberately has none: the checker threads the contextual type *down*,
// which is a better fit for a single pass and is why `self/nodes.ts` carries
// no `parent` field. The emitter's escape analysis is the one place that
// genuinely reads upwards — "what does the enclosing construct do with this
// value?" is a question about the consumer, and `src/codegen/escape.ts` and
// `attributes.ts` both answer it by walking `node.parent`.
//
// So the links are built here, once, as a side table indexed by `Node.id`,
// which is the same shape every other side table in stage1 has
// (`self/program.ts`). The AST still holds syntax only.
//
// One thing to know when reading a walk against `src/`: an argument list is
// an `N_LIST` node in this tree and is not in the `typescript` one, so the
// parent of an argument is the list and the construct that consumes it is the
// node above that. Every upward walk in `self/escape.ts` handles that step
// explicitly, because the index within the list is the argument index and it
// would be lost by skipping the list silently.

import { Node } from "./nodes";

export class ParentTable {
  /** Node id -> the node that has it as a child; `null` for the source file. */
  parents: (Node | null)[];

  constructor(file: Node, nodeCount: i32) {
    this.parents = new Array<Node | null>(nodeCount);
    this.link(file);
  }

  link(node: Node): void {
    for (const child of node.children) {
      this.parents[child.id] = node;
      this.link(child);
    }
  }

  parentOf(node: Node): Node | null {
    return this.parents[node.id];
  }
}
