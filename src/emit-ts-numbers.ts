// The numbers row of `--emit-ts` (wp33 §3): the rewrites a number needs under
// Node, where every number is a double and the width types do not exist.
//
// The composer (`src/emit-ts-edits.ts`) calls this hook once per node,
// children first, in the fixed order numbers, strings, records, control; a
// later row sees a node only when every earlier one answered `null`. The
// contract, for the stage that fills it:
//
// - Answer `null` for a node this row has nothing to say about. Then the node
//   is written as its source span with its changed children spliced in.
// - Answer the node's whole text otherwise. `operands.at(i)` is child `i` as
//   it will be written, so a rewrite composes with the rows below it.
// - A rewrite that calls a `nish/runtime` export asks for it with
//   `walk.useHelper(name)`; the driver writes the import line.
// - Read types through `walk.program`: inside a generic body the composer has
//   installed one instance's tables, and it holds every instance to the same
//   answer.
//
// This stage writes the skeleton only, so the row rewrites nothing yet.

import { Operands, Walk } from "./emit-ts-edits"
import { Node } from "./nodes"

/** The numbers row's rewrite of `node`, or `null` to leave it to the next row. */
export const numbersRow = (_walk: Walk, _node: Node, _operands: Operands): string | null => null
