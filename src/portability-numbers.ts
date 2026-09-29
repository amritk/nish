// The WP33 portability rows for numbers (docs/wp33-round-trip.md §3.1 and 3.5):
// integer division (NL8006), wrapping arithmetic (NL8007), the i32 `>>>`
// (NL8008), 64-bit integers (NL8009), libm's NaN and signed-zero rules (NL8010)
// and a printed negative zero (NL8011).
//
// TODO(WP33): the rows land with the `portability-numbers` stage; until then no
// code of this module is live, and `tests/wordings/unreachable.txt` says so.

import { Node } from "./nodes"
import { PortabilityFinding, PortabilityWalk } from "./portability"

/**
 * The numbers rows, asked about one node at a time.
 *
 * `src/portability.ts` calls this once for every node of every checked
 * function body, in source order, after NL8005 and before the next row
 * module; an arrow argument's body is handed over under its own function
 * rather than inside its parent's. `walk` carries the facts
 * (`PortabilityWalk`): the module with this body's side tables installed —
 * a generic instantiation's own, so a type read there is concrete — the type
 * table, the options (`--wrapping`, `--number-mode`), the parent links, and
 * the function and body being walked.
 *
 * A site is reported by appending `new PortabilityFinding(node, message)` to
 * `out`; `node` is where the caret goes and `message` must contain its
 * row's fragment from `portabilityRules` in `src/codes.ts` verbatim. The
 * order findings are appended in does not matter — the sink sorts them — and a
 * finding repeated at one node with one message is kept once. (The stub's
 * parameters carry a `_` only until they are read.)
 */
export const numberFindings = (_walk: PortabilityWalk, _node: Node, _out: PortabilityFinding[]): void => {
  // No row of this module is live yet: see the TODO in the header.
}
