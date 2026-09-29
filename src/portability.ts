// The WP33 portability pass (docs/wp33-round-trip.md §5.2): the sites where a
// program that compiles here and its TypeScript reading, run under Node with
// `runtime/nish.mjs`, both run to the end and quietly answer differently.
//
// It is a pass over the checked program and nothing more. It runs after
// `Compilation.check` has finished, and only under `--warn-portability`, so a
// compile without the flag does none of this work. It reads the checker's side
// tables and never works a type out for itself: the checker records and the
// passes after it read (orientation rule 1). It reports warnings and never an
// error, it changes no byte of the IR, and the driver prints what it finds only
// for a compilation that checked cleanly.
//
// Which sites it reports is the class-C list of wp33 §3, one row per code in
// `portabilityRules` (`src/codes.ts`), and the rows are split by family into
// three modules this pass hands every node to:
//
//   `portability-numbers.ts`  integer division, wrapping, `>>>`, 64-bit
//                             integers, libm's NaN and signed zero, `-0` printed
//   `portability-strings.ts`  UTF-8 offsets that meet an outside fact, `slice`
//   `portability-records.ts`  a record copied into an array, a store over an
//                             element a reference still reads
//
// NL8005, the zero-filled `new Array<T>(n)`, is here rather than in a module of
// its own: it is one node read against one table, and it is the row that proves
// the path from the flag to the report works end to end.
//
// What is not reported, on purpose: a structural difference (`orReturn`, `Ok`
// and `Err`, a host global, a `nish:` specifier, `export const main`, `enum`)
// fails loudly under plain TypeScript, so the TypeScript tests already notice
// it; `Float64Array.push` is closed by WP33 R2; and `toI32` already means under
// the prelude what it means natively. A warning here is a divergence nothing
// else would catch.
//
// Nor is the standard library walked. Its sites are not the reader's to
// change, and the one that shows why is `std/collections.ts`: its buckets are a
// zero-filled `new Array<u32>(n)`, but the TypeScript reading of a program that
// uses `Map` never runs that file at all, because Node has a `Map` of its own.

import { AnalysisUnit } from "./attributes"
import { CLI } from "./branding"
import { numericLiteralValue } from "./constants"
import { StringSet } from "./map"
import { FLAG_PREFIX, N_ARROW, N_IDENT, N_NEW, N_NUMBER, N_PAREN, N_UNARY, Node } from "./nodes"
import { Options } from "./options"
import { ParentTable } from "./parents"
import { numberFindings } from "./portability-numbers"
import { recordFindings } from "./portability-records"
import { stringFindings } from "./portability-strings"
import { CheckedProgram, FunctionSig } from "./program"
import { isFloat, isNumeric, T_BOOL, TypeTable } from "./types"

/**
 * One portability warning before it is a diagnostic: the node it is reported
 * at, whose span is the caret, and the whole message. The message has to
 * contain its row's fragment from `portabilityRules` verbatim, because that
 * fragment is what `codeFor` reads its code out of.
 */
export class PortabilityFinding {
  node: Node
  message: string

  constructor(node: Node, message: string) {
    this.node = node
    this.message = message
  }
}

/**
 * Everything a row is handed about the function it is looking at. It is the
 * whole contract between this pass and the three row modules, so a row that
 * needs one more fact should find it through here rather than import the
 * checker.
 *
 * - `program` is the module, with the side tables of *this body* installed:
 *   for a generic instantiation that is the instantiation's own tables
 *   (`CheckedProgram.enterInstance`), so `program.nodeTypes[node.id]` is the
 *   concrete type at that node whichever function is being walked. Read the
 *   type of an expression there, a binding in `nodeLocals`, a call's callee in
 *   `nodeCallees`, a folded constant in `nodeConstants` and the bounds proofs
 *   in `nodeProvenIndex` / `nodeProvenClamp`; never recompute one.
 * - `table` interns every type id those tables hold (`typeName` spells one).
 * - `opts` is the command line as it reached the checker: `nsw` is false
 *   under `--wrapping`, `numberMode` says what `number` is, and
 *   `uncheckedIndexing` whether indices are checked at all.
 * - `parents` finds a node's parent, which the tree itself does not carry.
 * - `sig` and `body` are the function being walked and its body, which is
 *   the root to scan when a row needs what happens before or after a node.
 */
export class PortabilityWalk {
  program: CheckedProgram
  table: TypeTable
  opts: Options
  parents: ParentTable
  sig: FunctionSig
  body: Node

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    opts: Options,
    parents: ParentTable,
    sig: FunctionSig,
    body: Node
  ) {
    this.program = program
    this.table = table
    this.opts = opts
    this.parents = parents
    this.sig = sig
    this.body = body
  }

  /** The source text of `node`, as a message quotes it. */
  textOf(node: Node): string {
    return this.program.source.text.substring(node.start, node.end)
  }
}

/**
 * The portability warnings of one module of the program's own (the standard
 * library is `CLI`'s package, and skipped): every function body it defines,
 * each generic instantiation with its own tables, walked in source order with
 * each node handed to NL8005 and then to the three row modules.
 *
 * An instantiation is walked, where the performance class walks only the
 * template, because a row can depend on the type argument: `new Array<T>(n)`
 * diverges when `T` is `f64` and cannot be compiled when it is a class. The
 * same node can then be found once per instantiation, so a finding already
 * made at one node with one message is not made again.
 */
export const portabilityFindings = (
  unit: AnalysisUnit,
  table: TypeTable,
  opts: Options
): PortabilityFinding[] => {
  const program = unit.program
  const out: PortabilityFinding[] = []
  if (program.packageName === CLI) {
    return out
  }
  const seen = new StringSet()
  for (const sig of program.functions) {
    const body = sig.body()
    if (body === null || sig.poisoned || !sig.definedIn(program.source)) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const found: PortabilityFinding[] = []
    walkPortability(new PortabilityWalk(program, table, opts, unit.parents, sig, body), body, found)
    if (instance !== null) {
      program.leaveInstance()
    }
    for (const finding of found) {
      if (seen.add(`${finding.node.id}:${finding.message}`)) {
        out.push(finding)
      }
    }
  }
  return out
}

/**
 * One node and everything under it. An arrow argument is skipped because it
 * is a function of its own, lifted into `program.functions` and walked there;
 * walking it here as well would report each of its sites twice.
 */
const walkPortability = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  zeroFillFinding(walk, node, out)
  numberFindings(walk, node, out)
  stringFindings(walk, node, out)
  recordFindings(walk, node, out)
  for (const child of node.children) {
    walkPortability(walk, child, out)
  }
}

/**
 * NL8005: `new Array<T>(n)` of a number or a boolean is `n` zeros (or `false`s)
 * here, and `n` holes in TypeScript, which read back as `undefined` — so a sum
 * over it is `NaN` there and 0 here. A length whose value is zero has no
 * element to differ (`isZeroLength`), and `[]` is not this node at all. The typed-array aliases are not
 * reported: `new Float64Array(n)` is zero-filled in JavaScript too.
 */
/**
 * Whether a length is zero by its value, whatever its spelling: a literal of
 * any radix or form (`0x0`, `0b0_0`, `0.0`), a sign in front of one (`-0`),
 * parentheses, or a named constant, whose folded value the checker recorded in
 * `nodeConstants` (the reading `constantLength` in `src/inline-arrays.ts`
 * makes). Anything else is a length that may not be zero.
 */
const isZeroLength = (walk: PortabilityWalk, expr: Node): boolean => {
  if (expr.kind === N_NUMBER) {
    return numericLiteralValue(expr.text) === 0
  }
  if (expr.kind === N_PAREN) {
    return isZeroLength(walk, expr.children[0])
  }
  if (expr.kind === N_UNARY && expr.flags === FLAG_PREFIX && (expr.text === "-" || expr.text === "+")) {
    return isZeroLength(walk, expr.children[0])
  }
  const constant = walk.program.nodeConstants[expr.id]
  if (constant === null) {
    return false
  }
  return isFloat(constant.type) ? constant.floatValue === 0 : constant.intValue === toI64(0)
}

const zeroFillFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node.kind !== N_NEW || node.children[0].kind !== N_IDENT || node.children[0].text !== "Array") {
    return
  }
  const args = node.children[2].children
  if (args.length !== 1 || isZeroLength(walk, args[0])) {
    return
  }
  const type = walk.program.nodeTypes[node.id]
  if (!walk.table.isArray(type)) {
    return
  }
  const element = walk.table.baseOf(walk.table.refOf(type))
  if (!isNumeric(element) && element !== T_BOOL) {
    return
  }
  out.push(
    new PortabilityFinding(
      node,
      `\`${walk.textOf(node)}\` is filled with zeros here, and with holes in TypeScript, which read back as \`undefined\``
    )
  )
}
