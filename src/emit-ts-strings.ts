// The strings row of `--emit-ts` (wp33 §3): the rewrites a string or a byte
// needs under Node, where a string is UTF-16 rather than bytes.
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
// Every offset an Nish string takes or gives counts UTF-8 bytes, so each
// member that reads one is written as a call of the core helper that counts
// them (`runtime/core/strings.mjs`): `s.length` as `strLen(s)`, and
// `s.charCodeAt`, `s.indexOf`, `s.slice` and `s.substring` as the helper of
// that name with the receiver first. `startsWith` and `endsWith` answer the
// same over code units as over bytes and stay as written. `String.fromBytes`
// decodes its bytes as UTF-8 (`utf8FromBytes`), `String.fromCharCode` builds
// the string of one code unit, and `Number` of a string parses as the native
// runtime does (`number`). `parseInt` and `parseFloat` need nothing here: the
// composer imports the core's for every ambient call already, so the global
// is never reached.
//
// A `?.` chain ends in `??`, so a string's `.length` closes its chain, and
// `o?.s.length` is `strLenOpt(o?.s)`: the chain evaluated once, as the
// argument, and `undefined` when it stopped short.
//
// What this row does not make agree:
//
// - A byte-offset method inside a `?.` chain (`s?.slice(0, 1)`) stays as
//   written, so it counts UTF-16 units past ASCII. A call skips its arguments
//   when the chain stops, so a faithful form is a conditional expression, not
//   a helper call.
// - `String.fromCharCode` of 128 and up is the Latin-1 character, two UTF-8
//   bytes where native builds one (LANGUAGE.md's C row), so it and
//   `String.fromBytes` disagree over the same bytes.
// - Decoding is lossy: `String.fromBytes` of bytes that are not UTF-8, or a
//   `slice` or `substring` through a character, gives U+FFFD where native
//   keeps the bytes, and the length changes with it.
// - A helper is imported under its own name (`useHelper` cannot alias it), so
//   a program that binds `slice`, `number`, `indexOf`, ... itself would shadow
//   or clash with it. No program of the corpus does.

import { Operands, Walk } from "./emit-ts-edits"
import { isOptionalChain } from "./emit-util"
import { N_CALL, N_IDENT, N_MEMBER, Node } from "./nodes"
import { T_STRING } from "./types"

/** The string methods whose offsets count bytes, each a core helper of the same name. */
const OFFSET_METHODS: string = " charCodeAt indexOf slice substring "

/** The `String` statics, each with the core helper that builds it. */
const stringStaticHelper = (member: string): string => {
  if (member === "fromBytes") {
    return "utf8FromBytes"
  }
  if (member === "fromCharCode") {
    return "fromCharCode"
  }
  return ""
}

/** Whether `node`'s value is an Nish string, as the checker typed it. */
const typedString = (walk: Walk, node: Node): boolean => walk.program.nodeTypes[node.id] === T_STRING

/** `helper(args)` with its import asked for: `args` is the call's argument list as it will be written. */
const stringHelperCall = (walk: Walk, helper: string, args: string): string => {
  walk.useHelper(helper)
  return `${helper}(${args})`
}

/**
 * The receiver of `member`, a method callee written as `memberText`, as it
 * will be written: the callee's text up to the `.name` the source spells after
 * the receiver, which no row rewrites. `null` when the text does not end in it.
 */
const methodReceiverText = (walk: Walk, member: Node, memberText: string): string | null => {
  const suffix = walk.source.text.substring(member.children[0].end, member.end)
  if (!memberText.endsWith(suffix)) {
    walk.fail(`--emit-ts: the callee \`${walk.spanOf(member)}\` lost its member name`)
    return null
  }
  return memberText.substring(0, memberText.length - suffix.length)
}

/** `s.length` on a string: its byte length, `undefined` where a `?.` chain stopped. */
const stringLengthRewrite = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.text !== "length" || !typedString(walk, node.children[0])) {
    return null
  }
  return stringHelperCall(walk, isOptionalChain(node) ? "strLenOpt" : "strLen", operands.at(0))
}

/** A call this row rewrites: a byte-offset method of a string, a `String` static, or `Number` of a string. */
const stringCallRewrite = (walk: Walk, node: Node, operands: Operands): string | null => {
  const callee = node.children[0]
  const args = node.children[1]
  if (walk.program.nodeCallees[node.id] !== null) {
    return null
  }
  if (callee.kind === N_IDENT) {
    if (
      callee.text !== "Number" ||
      walk.program.nodeBuiltins[node.id].length > 0 ||
      args.children.length !== 1 ||
      !typedString(walk, args.children[0])
    ) {
      return null
    }
    return stringHelperCall(walk, "number", operands.at(1))
  }
  if (callee.kind !== N_MEMBER) {
    return null
  }
  const receiver = callee.children[0]
  if (receiver.kind === N_IDENT && receiver.text === "String") {
    const helper = stringStaticHelper(callee.text)
    return helper.length === 0 ? null : stringHelperCall(walk, helper, operands.at(1))
  }
  // A helper call taking arguments cannot sit inside a `?.` chain, whose short
  // circuit skips them, so the method stays as written: right for ASCII text.
  if (isOptionalChain(node)) {
    return null
  }
  if (OFFSET_METHODS.indexOf(` ${callee.text} `) < 0 || !typedString(walk, receiver)) {
    return null
  }
  const target = methodReceiverText(walk, callee, operands.at(0))
  if (target === null) {
    return null
  }
  return stringHelperCall(walk, callee.text, `${target}, ${operands.at(1)}`)
}

/** The strings row's rewrite of `node`, or `null` to leave it to the next row. */
export const stringsRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.kind === N_MEMBER) {
    return stringLengthRewrite(walk, node, operands)
  }
  if (node.kind === N_CALL && node.children.length === 2) {
    return stringCallRewrite(walk, node, operands)
  }
  return null
}
