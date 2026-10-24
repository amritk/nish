// The records row of `--emit-ts` (wp33 §3): the rewrites a record, a class or a
// collection needs under Node.
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
// What this row writes is the array row of §3.3:
//
// - An index the checker did not prove in range is `idx(a, i)`, which panics
//   as the native program does; a proven one stays `a[i]`. A store and a
//   compound store through such an index become `setIdx` and `updIdx`, and
//   an unproven `pop()` becomes `pop(a)`.
// - A record held inline in an array is a value: `push(p)` and `[p, q]` put a
//   spread copy `{ ...p }` in the slot, and a store into a slot writes field
//   by field into the element already there (`Object.assign`), so a
//   reference taken to the slot sees it.
// - `new Array<T>(n)` is `newArray(n, zero)` and `dst.set(src, at)` is
//   `arraySet(dst, src, at)`, each checked as the native one is.
//
// The hook sees no type table, so "a record held inline" is read off the
// program's struct list: an interface no class implements. A generic body is
// written once for all its instances, so there the runtime's `copyIn` and
// `storeIdx` decide by looking at the value: any plain object is a record. A
// generic whose instances would need different TypeScript (an element inline
// in one and by reference in another) is refused with NL4013 by the composer.

import { Operands, Walk } from "./emit-ts-edits"
import {
  FLAG_OPTIONAL,
  N_ARRAY,
  N_BIGINT,
  N_BINARY,
  N_CALL,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_SPREAD,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_REF,
  N_TYPE_UNION,
  Node,
} from "./nodes"
import { CheckedProgram, STRUCT_INTERFACE } from "./program"
import { T_BOOL, T_CPTR, T_I64, T_U64 } from "./types"

/** Whether `type` is a record an array holds inline: an interface no class implements. */
const inlineRecord = (program: CheckedProgram, type: i32): boolean => {
  if (type <= T_CPTR) {
    return false
  }
  for (const info of program.structList) {
    if (info.type === type) {
      return info.kind === STRUCT_INTERFACE && !info.implemented
    }
  }
  return false
}

/** Whether the program declares any record an array would hold inline. */
const hasInlineRecords = (program: CheckedProgram): boolean => {
  for (const info of program.structList) {
    if (info.kind === STRUCT_INTERFACE && !info.implemented) {
      return true
    }
  }
  return false
}

// How a value put into a slot is copied in: not at all, as a spread copy, or
// through `copyIn`, which looks at the value when it runs. Only a slot that
// holds a record inline copies; a `(P | null)[]` slot holds a reference. A
// generic body is written once for every instance and one instance's element
// can be a record where another's is a number, so in an instance the choice
// is made at run time for a slot that holds a record inline or none at all.
// An instance whose slot holds a reference to a record writes no copy, and
// the composer reports a generic whose instances disagree on that.
const COPY_NONE: i32 = 0
const COPY_SPREAD: i32 = 1
const COPY_AT_RUN: i32 = 2

/** Whether a slot of `type` holds a reference to a record an array would otherwise hold inline. */
const recordReference = (walk: Walk, type: i32): boolean =>
  type >= 0 && walk.table.isNullable(type) && inlineRecord(walk.program, walk.table.refOf(type))

/** How a value put into a slot of type `slot` is copied in. */
const slotCopy = (walk: Walk, slot: i32): i32 => {
  if (walk.inInstance) {
    return hasInlineRecords(walk.program) && !recordReference(walk, slot) ? COPY_AT_RUN : COPY_NONE
  }
  return inlineRecord(walk.program, slot) ? COPY_SPREAD : COPY_NONE
}

/** How `value`, put into an array slot of type `slot`, is copied in. */
const copyKind = (walk: Walk, slot: i32, value: Node): i32 => {
  if (
    value.kind === N_OBJECT ||
    value.kind === N_SPREAD ||
    value.kind === N_NUMBER ||
    value.kind === N_BIGINT
  ) {
    return COPY_NONE
  }
  return slotCopy(walk, slot)
}

/** The element type of the array type `type`, or -1. */
const elementOf = (walk: Walk, type: i32): i32 =>
  type >= 0 && walk.table.isArray(type) ? walk.table.refOf(type) : -1

/** `written`, the text of `value`, as the copy a slot of type `slot` takes in, or `written` itself. */
const copied = (walk: Walk, slot: i32, value: Node, written: string): string => {
  const kind = copyKind(walk, slot, value)
  if (kind === COPY_SPREAD) {
    return `{ ...${written} }`
  }
  if (kind === COPY_AT_RUN) {
    return `${walk.helperName("copyIn")}(${written})`
  }
  return written
}

/**
 * Whether the index at `node` (an N_INDEX, or the call of a `pop`) is written
 * checked. A generic body is written once for all its instances, and one
 * instance can prove an index another cannot, so there it is always checked.
 */
const checkedAt = (walk: Walk, node: Node): boolean =>
  !walk.program.uncheckedIndexing && (walk.inInstance || !walk.program.nodeProvenIndex[node.id])

/**
 * The `a, i` of a written `idx(a, i)`, or of `__nish_idx(a, i)` where the
 * module binds `idx`, or the empty string when `text` is no such call.
 */
export const idxArguments = (text: string): string => {
  if (!text.endsWith(")")) {
    return ""
  }
  if (text.startsWith("idx(")) {
    return text.substring(4, text.length - 1)
  }
  if (text.startsWith("__nish_idx(")) {
    return text.substring(11, text.length - 1)
  }
  return ""
}

/**
 * The `a, i` of a written element `a[i]`, or the empty string when `text` ends
 * in no index. The scan pairs brackets outside quoted strings; a template
 * literal, whose `${}` it does not follow, gives the empty string.
 */
export const elementArguments = (text: string): string => {
  if (!text.endsWith("]") || text.indexOf("`") >= 0) {
    return ""
  }
  let depth = 0
  let open = -1
  // The quote a quoted string opened, whose brackets are text, or 0.
  let quote = 0
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (quote !== 0) {
      if (escaped) {
        escaped = false
      } else if (c === 92) {
        escaped = true
      } else if (c === quote) {
        quote = 0
      }
    } else if (c === 34 || c === 39) {
      quote = c
    } else if (c === 40 || c === 91 || c === 123) {
      if (depth === 0 && c === 91) {
        open = i
      }
      depth = depth + 1
    } else if (c === 41 || c === 93 || c === 125) {
      depth = depth - 1
    }
  }
  if (depth !== 0 || open <= 0) {
    return ""
  }
  return `${text.substring(0, open)}, ${text.substring(open + 1, text.length - 1)}`
}

/** `text` with the `.name` of the member access it ends in taken off. */
const writtenReceiver = (text: string, name: string): string =>
  text.substring(0, text.length - name.length - 1)

/** Whether `node` reads as one operand where an operator's right side goes. */
const atomic = (node: Node): boolean =>
  node.kind === N_IDENT ||
  node.kind === N_NUMBER ||
  node.kind === N_BIGINT ||
  node.kind === N_CALL ||
  node.kind === N_INDEX ||
  node.kind === N_MEMBER ||
  node.kind === N_PAREN

/** A parameter name for an update callback that `text` does not already spell. */
const updateParam = (text: string): string => {
  if (text.indexOf("old") < 0) {
    return "old"
  }
  let n = 1
  while (text.indexOf(`old${n}`) >= 0) {
    n = n + 1
  }
  return `old${n}`
}

/** `updIdx(a, i, (old) => old OP value)`, the compound store `a[i] OP= value` through a checked index. */
const compoundStore = (walk: Walk, node: Node, operands: Operands, args: string): string => {
  const op = node.text.substring(0, node.text.length - 1)
  const written = operands.at(1)
  const value = atomic(node.children[1]) ? written : `(${written})`
  const old = updateParam(written)
  return `${walk.helperName("updIdx")}(${args}, (${old}) => ${old} ${op} ${value})`
}

/** The rewrite of an assignment `a[i] = v` or `a[i] OP= v`, or `null`. */
const storeRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const target = node.children[0]
  if (target.kind !== N_INDEX) {
    return null
  }
  const left = operands.at(0)
  let args = idxArguments(left)
  if (node.text === "=") {
    const record = slotCopy(walk, walk.program.nodeTypes[target.id]) !== COPY_NONE
    // An instance under unchecked indexing writes a plain `a[i]`, but its
    // slot can hold a record inline, which `storeIdx` writes field by field.
    if (record && args === "" && walk.inInstance) {
      args = elementArguments(left)
    }
    if (record && args !== "") {
      return `${walk.helperName("storeIdx")}(${args}, ${operands.at(1)})`
    }
    if (record && !walk.inInstance) {
      return `Object.assign(${left}, ${operands.at(1)})`
    }
    if (args === "") {
      return null
    }
    return `${walk.helperName("setIdx")}(${args}, ${operands.at(1)})`
  }
  if (!node.text.endsWith("=") || node.text === "==" || node.text === "===") {
    return null
  }
  if (node.text === "!=" || node.text === "!==" || node.text === "<=" || node.text === ">=") {
    return null
  }
  // A proven index still stores through `updIdx`, which checks it again after
  // the right side ran: the right side can shrink the array.
  if (args === "" && !walk.program.uncheckedIndexing) {
    args = elementArguments(left)
  }
  return args === "" ? null : compoundStore(walk, node, operands, args)
}

/** The rewrite of a builtin array method call — `pop`, `push` of a record, `set` — or `null`. */
const recordCallRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const callee = node.children[0]
  if (callee.kind !== N_MEMBER || walk.program.nodeCallees[node.id] !== null) {
    return null
  }
  const args = node.children[1].children
  const method = callee.text
  const written = operands.at(0)
  if (!written.endsWith(`.${method}`)) {
    return null
  }
  const receiver = writtenReceiver(written, method)
  if (method === "pop" && args.length === 0 && checkedAt(walk, node)) {
    return `${walk.helperName("pop")}(${receiver})`
  }
  if (method === "push" && args.length === 1) {
    const arg = operands.at(1)
    const copy = copied(walk, elementOf(walk, walk.program.nodeTypes[callee.children[0].id]), args[0], arg)
    return copy === arg ? null : `${written}(${copy})`
  }
  if (
    method === "set" &&
    args.length > 0 &&
    args.length <= 2 &&
    walk.program.nodeTypes[args[0].id] > T_CPTR &&
    walk.program.nodeTypes[args[0].id] === walk.program.nodeTypes[callee.children[0].id]
  ) {
    return `${walk.helperName("arraySet")}(${receiver}, ${operands.at(1)})`
  }
  return null
}

/** An array literal rebuilt with a copy for each element that could be a record, or `null`. */
const literalRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const slot = elementOf(walk, walk.program.nodeTypes[node.id])
  const parts: string[] = []
  let copies = false
  let i = 0
  while (i < node.children.length) {
    const written = operands.at(i)
    const part = copied(walk, slot, node.children[i], written)
    if (part !== written) {
      copies = true
    }
    parts.push(part)
    i = i + 1
  }
  return copies ? `[${parts.join(", ")}]` : null
}

/** The zero of a primitive or nullable type id, or the empty string for any other type. */
const primitiveZero = (walk: Walk, type: i32): string => {
  if (type >= 0 && walk.table.isNullable(type)) {
    return "null"
  }
  if (type === T_I64 || type === T_U64) {
    return "0n"
  }
  if (type === T_BOOL) {
    return "false"
  }
  return type >= 1 && type < T_BOOL ? "0" : ""
}

/**
 * The zero `new Array<T>(n)` fills each slot with, read off the written `T`, or the empty string.
 * In a generic body `T` is the instance's binding; instances whose zeros
 * differ are written differently, which the composer reports.
 */
const fillZero = (walk: Walk, type: Node): string => {
  if (type.kind === N_TYPE_PAREN) {
    return fillZero(walk, type.children[0])
  }
  if (type.kind === N_TYPE_UNION) {
    for (const member of type.children) {
      if (member.kind === N_TYPE_NULL) {
        return "null"
      }
    }
    return ""
  }
  if (type.kind !== N_TYPE_REF) {
    return ""
  }
  const name = type.text
  if (name === "i64" || name === "u64") {
    return "0n"
  }
  if (name === "boolean") {
    return "false"
  }
  if (
    name === "number" ||
    name === "integer" ||
    name === "i32" ||
    name === "u8" ||
    name === "u16" ||
    name === "u32" ||
    name === "f32" ||
    name === "f64"
  ) {
    return "0"
  }
  const program = walk.program
  if (program.enums.get(name, -1) >= 0) {
    return "0"
  }
  const dot = name.indexOf(".")
  if (dot > 0 && program.enums.get(name.substring(0, dot), -1) >= 0) {
    return "0"
  }
  const alias = program.alias(name)
  if (alias !== null) {
    return fillZero(walk, alias.decl.children[1])
  }
  const instance = program.activeInstance
  if (instance !== null) {
    return primitiveZero(walk, instance.bindings.get(name, -1))
  }
  return ""
}

/** The typed arrays `new` builds zero-filled, each with its zero. */
const typedArrayZero = (name: string): string => {
  if (name === "Float64Array" || name === "Float32Array" || name === "Int32Array") {
    return "0"
  }
  return name === "BigInt64Array" ? "0n" : ""
}

/** `new Array<T>(n)` or `new Float64Array(n)` as a checked, zero-filled `newArray`, or `null`. */
const newRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  const callee = node.children[0]
  if (callee.kind !== N_IDENT || node.children[2].children.length !== 1) {
    return null
  }
  const typeArgs = node.children[1].children
  let zero = ""
  if (callee.text === "Array" && typeArgs.length === 1) {
    zero = fillZero(walk, typeArgs[0])
  } else if (typeArgs.length === 0) {
    zero = typedArrayZero(callee.text)
  }
  if (zero === "") {
    return null
  }
  return `${walk.helperName("newArray")}(${operands.at(2)}, ${zero})`
}

/** The records row's rewrite of `node`, or `null` to leave it to the next row. */
export const recordsRow = (walk: Walk, node: Node, operands: Operands): string | null => {
  switch (node.kind) {
    case N_INDEX:
      if ((node.flags & FLAG_OPTIONAL) !== 0 || !checkedAt(walk, node)) {
        return null
      }
      return `${walk.helperName("idx")}(${operands.at(0)}, ${operands.at(1)})`
    case N_BINARY:
      return storeRow(walk, node, operands)
    case N_CALL:
      return recordCallRow(walk, node, operands)
    case N_ARRAY:
      return literalRow(walk, node, operands)
    case N_NEW:
      return newRow(walk, node, operands)
    default:
      return null
  }
}
