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
//   `walk.helperName(name)` and writes the name it answers, which is
//   `__nish_<name>` where the module spells `name` itself; the driver writes
//   the import line.
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
// A `\u{…}` escape in a string or template literal is written as the
// `\uXXXX` code units it stands for, a surrogate pair past U+FFFF: Node's type
// stripper rejects `"\uD83D\u{DE00}"` inside a template's `${…}`, which is
// valid TypeScript, and the two spellings are one string.
//
// `tsc` gives an unannotated binding of a string literal the literal's own
// type, and then refuses `===` against a different literal as a comparison
// with no overlap; to Nish both are `string`. Such a binding is written
// `name: string = "…"`, and a comparison of two literals writes its left one
// `("…" as string)`.
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

import { Operands, Walk } from "./emit-ts-edits"
import { isOptionalChain } from "./emit-util"
import {
  N_BINARY,
  N_CALL,
  N_EMPTY,
  N_IDENT,
  N_MEMBER,
  N_STRING,
  N_TEMPLATE_TEXT,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { StringBuilder } from "./strings"
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
const stringHelperCall = (walk: Walk, helper: string, args: string): string =>
  `${walk.helperName(helper)}(${args})`

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

/** The value of one hex digit, or -1. */
const escapeDigit = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  return c >= 65 && c <= 70 ? c - 55 : -1
}

/** `\u` and `unit` as four uppercase hex digits, added a character at a time so nothing is left behind. */
const addUnitEscape = (out: StringBuilder, unit: i64): void => {
  out.addChar(92)
  out.addChar(117)
  let shift = 12
  while (shift >= 0) {
    const digit = toI32(unit >> toI64(shift)) & 15
    out.addChar(digit < 10 ? digit + 48 : digit + 55)
    shift = shift - 4
  }
}

/** A literal's source with each `\u{…}` escape as its `\uXXXX` code units, or `null` when it has none. */
const unbracedEscapes = (text: string): string | null => {
  if (text.indexOf("\\u{") < 0) {
    return null
  }
  const out = new StringBuilder()
  let i = 0
  while (i >= 0 && i < text.length) {
    const c = text.charCodeAt(i)
    if (c !== 92 || i + 1 >= text.length) {
      out.addChar(c)
      i = i + 1
      continue
    }
    // `\u{`, hex digits and `}`; any other escape, `\\` among them, is copied whole.
    let end = i + 3
    let value: i64 = 0
    let digits = 0
    if (text.charCodeAt(i + 1) === 117 && i + 2 < text.length && text.charCodeAt(i + 2) === 123) {
      while (end < text.length && escapeDigit(text.charCodeAt(end)) >= 0) {
        value = value * 16 + toI64(escapeDigit(text.charCodeAt(end)))
        digits = digits + 1
        end = end + 1
      }
    }
    if (digits === 0 || digits > 6 || end >= text.length || text.charCodeAt(end) !== 125 || value > 1114111) {
      out.addChar(c)
      out.addChar(text.charCodeAt(i + 1))
      i = i + 2
      continue
    }
    if (value > 65535) {
      addUnitEscape(out, toI64(55296) + ((value - toI64(65536)) >> toI64(10)))
      addUnitEscape(out, toI64(56320) + ((value - toI64(65536)) & toI64(1023)))
    } else {
      addUnitEscape(out, value)
    }
    i = end + 1
  }
  return out.toText()
}

/**
 * An unannotated `const` binding of a string literal, written with `: string`
 * so `tsc` does not narrow it to the literal. A `let` is left as written:
 * TypeScript widens it already, and a class-A module stays byte for byte. The
 * keyword is on the statement, not the declaration, so it is read from the
 * text just before the name; a later declaration of the list, after a comma,
 * is left too.
 */
const widenedBinding = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.children.length !== 3 || node.children[0].kind !== N_IDENT || node.children[1].kind !== N_EMPTY) {
    return null
  }
  const name = node.children[0]
  const init = node.children[2]
  if (init.kind !== N_STRING) {
    return null
  }
  const text = walk.source.text
  let before = name.start
  while (before > 0 && (text.charCodeAt(before - 1) === 32 || text.charCodeAt(before - 1) === 9)) {
    before = before - 1
  }
  if (before < 5 || text.substring(before - 5, before) !== "const") {
    return null
  }
  return `${operands.at(0)}: string${text.substring(name.end, init.start)}${operands.at(2)}${text.substring(init.end, node.end)}`
}

/** `"a" === "b"` with its left literal widened to `string`, which `tsc` would refuse as no overlap. */
const literalComparison = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.text !== "===" && node.text !== "!==") {
    return null
  }
  const left = node.children[0]
  const right = node.children[1]
  if (left.kind !== N_STRING || right.kind !== N_STRING) {
    return null
  }
  const text = walk.source.text
  return `(${operands.at(0)} as string)${text.substring(left.end, right.start)}${operands.at(1)}${text.substring(right.end, node.end)}`
}

/** The strings row's rewrite of `node`, or `null` to leave it to the next row. */
export const stringsRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  if (node.kind === N_STRING || node.kind === N_TEMPLATE_TEXT) {
    return unbracedEscapes(walk.spanOf(node))
  }
  if (node.kind === N_MEMBER) {
    return stringLengthRewrite(walk, node, operands)
  }
  if (node.kind === N_VAR_DECL) {
    return widenedBinding(walk, node, operands)
  }
  if (node.kind === N_BINARY) {
    return literalComparison(walk, node, operands)
  }
  if (node.kind === N_CALL && node.children.length === 2) {
    return stringCallRewrite(walk, node, operands)
  }
  return null
}
