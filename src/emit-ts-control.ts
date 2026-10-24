// The control row of `--emit-ts` (wp33 §3): the rewrites a statement needs
// under Node: a `switch`, a loop, a `Result` or a panic that Nish and
// JavaScript run differently.
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
// What it rewrites (§3.4, and the `enum` and `Arena` rows of §3.5):
//
// - `x.orReturn()` where its statement can take a prelude (`walk.canHoist`):
//   `const t = x;` and `if (t.isErr()) return Err(t.error);` go before the
//   statement and the call becomes `t.value`. Several in one statement hoist
//   left to right, which is the order they run in.
// - Any other `orReturn` stays a call, which the runtime's `orReturn` throws
//   from; the function, method or arrow around it then gets its body wrapped
//   in a `try` whose `catch` hands the throw to `caught`, which answers the
//   `Err` to return. A function nested in the body wraps its own, so it does
//   not count; `caught` rethrows anything that is not a propagation.
// - `enum E { A, B = 5 }` becomes `const E = { A: 0, B: 5 } as const;` and
//   `type E = (typeof E)[keyof typeof E];`, with the checker's member values,
//   and a member as a type, `E.A`, becomes `(typeof E.A)`. Nish has numeric
//   enums only, so there is no string member to write.
// - `Arena.used()` and its three siblings become the runtime's `arenaUsed`,
//   `arenaMark`, `arenaRelease` and `arenaReset`.
// - A `Result` annotation asks for the runtime's `Result`, so the output
//   type-checks; `Ok` and `Err` come with the ambient builtins.

import { Operands, splice, Walk } from "./emit-ts-edits"
import {
  FLAG_EXPORTED,
  N_ARROW,
  N_BLOCK,
  N_CALL,
  N_ENUM,
  N_FUNCTION,
  N_IDENT,
  N_MEMBER,
  N_METHOD,
  N_TYPE_REF,
  Node,
} from "./nodes"
import { StringBuilder } from "./strings"

/** The control row's rewrite of `node`, or `null` to leave it to the next row. */
export const controlRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const kind = node.kind
  if (kind === N_CALL) {
    return isOrReturn(walk, node) ? hoistOrReturn(walk, node, operands) : null
  }
  if (kind === N_FUNCTION || kind === N_METHOD || kind === N_ARROW) {
    return wrapBody(walk, node, operands)
  }
  if (kind === N_ENUM) {
    return enumText(walk, node)
  }
  if (kind === N_TYPE_REF) {
    return typeRef(walk, node)
  }
  if (kind === N_MEMBER) {
    return arenaMember(walk, node)
  }
  return null
}

/** Whether `call` is `x.orReturn()` on a `Result`: no arguments, and bound to no method of the program. */
const isOrReturn = (walk: Walk, call: Node): boolean => {
  const callee = call.children[0]
  return (
    callee.kind === N_MEMBER &&
    callee.text === "orReturn" &&
    call.children.length > 1 &&
    call.children[1].children.length === 0 &&
    walk.program.nodeCallees[call.id] === null
  )
}

/** `t.value`, with `t`'s binding and its `Err` return hoisted before the statement; or `null` where nothing may hoist. */
const hoistOrReturn = (walk: Walk, call: Node, operands: Operands): string | null => {
  if (!walk.canHoist()) {
    return null
  }
  const member = call.children[0]
  const receiver = member.children[0]
  // The callee's text is the receiver's, as rewritten, then `.orReturn`
  // exactly as the source spells it.
  const callee = operands.at(0)
  const suffix = walk.source.text.substring(receiver.end, member.end)
  if (!callee.endsWith(suffix)) {
    walk.fail(
      `--emit-ts: the orReturn at ${walk.source.path}:${walk.source.lineOf(call.start)} lost its receiver`
    )
    return null
  }
  const t = walk.temporary()
  walk.hoist(`const ${t} = ${callee.substring(0, callee.length - suffix.length)};`)
  walk.hoist(`if (${t}.isErr()) return Err(${t}.error);`)
  walk.useHelper("Err")
  return `${t}.value`
}

/** `node` with its body inside a `try` that turns an `orReturn` throw into the `Err` it returns, when the body still calls one. */
const wrapBody = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.children.length < 4) {
    return null
  }
  const body = operands.at(3)
  // A hoisted `orReturn` is gone from the text; one still there may be a
  // method of the program's own, which the tree tells apart.
  if (body.indexOf("orReturn") < 0 || !callsOrReturn(walk, node.children[3])) {
    return null
  }
  const e = walk.temporary()
  const handler = ` catch (${e}) { return caught(${e}) } }`
  walk.useHelper("caught")
  const wrapped =
    node.children[3].kind === N_BLOCK ? `{ try ${body}${handler}` : `{ try { return ${body} }${handler}`
  operands.texts[3] = wrapped
  operands.changed[3] = true
  operands.any = true
  return splice(walk, node, operands)
}

/** Whether `node`, outside the functions nested in it, calls a `Result`'s `orReturn`. */
const callsOrReturn = (walk: Walk, node: Node): boolean => {
  if (node.kind === N_CALL && isOrReturn(walk, node)) {
    return true
  }
  for (const child of node.children) {
    const kind = child.kind
    if (kind !== N_FUNCTION && kind !== N_METHOD && kind !== N_ARROW && callsOrReturn(walk, child)) {
      return true
    }
  }
  return false
}

/** `const E = { … } as const;` and the type of the same name, for an `enum` this module declares. */
const enumText = (walk: Walk, node: Node): string | null => {
  const name = node.children[0]
  const info = walk.program.ownEnum(name.text)
  if (info === null) {
    return null
  }
  const text = walk.source.text
  const members = node.children[1].children
  const sb = new StringBuilder()
  const head = text.substring(node.start, name.start)
  const at = head.indexOf("enum")
  sb.add(head.substring(0, at))
  sb.add("const")
  sb.add(head.substring(at + 4))
  sb.add(name.text)
  const gapEnd = members.length > 0 ? members[0].start : node.end
  const gap = text.substring(name.end, gapEnd)
  const brace = gap.indexOf("{")
  sb.add(gap.substring(0, brace))
  sb.add("= ")
  sb.add(gap.substring(brace))
  let i = 0
  while (i < members.length) {
    const member = members[i]
    const index = info.members.get(member.children[0].text, -1)
    sb.add(`${member.children[0].text}: ${info.memberValues[index]}`)
    sb.add(text.substring(member.end, i + 1 < members.length ? members[i + 1].start : node.end))
    i = i + 1
  }
  sb.add(" as const;")
  const exported = (node.flags & FLAG_EXPORTED) !== 0 ? "export " : ""
  sb.add(`\n${exported}type ${name.text} = (typeof ${name.text})[keyof typeof ${name.text}];`)
  return sb.toText()
}

/** `E.A` as a type, which is a value of the `const` object now: `(typeof E.A)`. A `Result` asks for its import. */
const typeRef = (walk: Walk, node: Node): string | null => {
  const name = node.text
  if (name === "Result") {
    walk.useHelper("Result")
    return null
  }
  const dot = name.indexOf(".")
  if (dot < 0 || walk.program.enumNamed(name.substring(0, dot)) === null) {
    return null
  }
  return `(typeof ${walk.spanOf(node)})`
}

/** `Arena.used` and its siblings, as the runtime's free functions. */
const arenaMember = (walk: Walk, node: Node): string | null => {
  const receiver = node.children[0]
  if (
    receiver.kind !== N_IDENT ||
    receiver.text !== "Arena" ||
    walk.program.nodeLocals[receiver.id] !== null
  ) {
    return null
  }
  const helper = arenaHelper(node.text)
  if (helper !== null) {
    walk.useHelper(helper)
  }
  return helper
}

/** The runtime's free function for the `Arena` static `member`, or `null`. */
const arenaHelper = (member: string): string | null => {
  if (member === "used") {
    return "arenaUsed"
  }
  if (member === "mark") {
    return "arenaMark"
  }
  if (member === "release") {
    return "arenaRelease"
  }
  return member === "reset" ? "arenaReset" : null
}
