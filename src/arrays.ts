// Arrays for stage1 (stage0's `src/checker/arrays.ts`, docs/wp14-selfhost.md milestone
// S3, pass 2): literals, indexing, `length`, the six methods, `new Array<T>`
// and element assignment.

import { rejectForeignPointer, resolveType, typedArrayElement } from "./annotations"
import { checkBuiltinArity, isArgvExpression, requireStatementPosition } from "./builtins"
import { CheckContext } from "./context"
import { checkBitwiseAssignOperands, checkExpression, isBitwiseCompound, unproven } from "./expressions"
import { isArrayWriteMethod, storesInlineElements, unwrapParens } from "./emit-util"
import { checkIndexArgument } from "./members"
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CASE,
  N_CONSTRUCTOR,
  N_DEFAULT,
  N_DO,
  N_EMPTY,
  N_FIELD,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_NEW,
  N_PAREN,
  N_THIS,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_REF,
  N_TYPE_UNION,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes"
import { StringSet } from "./map"
import { CheckedProgram, inlineElementStruct } from "./program"
import { Local, Scope } from "./symbols"
import { isNumeric, T_ERROR, T_STRING, T_VOID, TypeTable } from "./types"

/** The method set, in the order the "supported:" message lists them. */
const ARRAY_METHODS: string = "push, pop, indexOf, join, set, fill"

/**
 * `[a, b]`. An empty literal takes its type from context, since there is
 * nothing to read. An element's proof does not become the element type
 * (#234): `[r]` inside `if (r.ok)` is a `Result<T, E>[]`, since anything
 * pushed later is checked against that type.
 */
export const checkArrayLiteral = (ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 => {
  if (expr.children.length === 0) {
    if (want < 0 || !ctx.table.isArray(want)) {
      return ctx.errorType(
        expr,
        "Empty array literal needs a type annotation, e.g. `const xs: number[] = []`"
      )
    }
    return want
  }
  const hint = want >= 0 && ctx.table.isArray(want) ? ctx.table.refOf(want) : -1
  let elem = -1
  for (const element of expr.children) {
    const type = unproven(ctx, checkExpression(ctx, element, scope, hint))
    if (type === T_ERROR) {
      continue
    }
    if (type === T_VOID) {
      ctx.error(element, "Array elements cannot be void")
      continue
    }
    if (elem < 0) {
      elem = type
    } else if (elem !== type) {
      const a = ctx.table.typeName(elem)
      ctx.error(
        element,
        `Array literal elements must all have the same type, got ${a} and ${ctx.table.typeName(type)}`
      )
    }
  }
  return elem < 0 ? T_ERROR : ctx.table.arrayOf(elem)
}

/** `a[i]`, which is also the target of `a[i] = v`. */
export const checkIndex = (ctx: CheckContext, expr: Node, scope: Scope): i32 => {
  const base = checkExpression(ctx, expr.children[0], scope, -1)
  if (base === T_ERROR) {
    return T_ERROR
  }
  if (ctx.table.isNullable(base)) {
    return ctx.errorType(
      expr.children[0],
      `Cannot index \`${ctx.table.typeName(base)}\`; check for null first: \`if (a !== null) { ... }\``
    )
  }
  if (!ctx.table.isArray(base)) {
    return ctx.errorType(
      expr.children[0],
      `Cannot index a value of type ${ctx.table.typeName(base)} (only arrays can be indexed)`
    )
  }
  const index = checkExpression(ctx, expr.children[1], scope, ctx.numberType())
  if (index !== T_ERROR && !isNumeric(index)) {
    ctx.error(expr.children[1], `Array index must be a number, got ${ctx.table.typeName(index)}`)
  }
  return ctx.table.refOf(base)
}

/**
 * The one rule a `readonly T[]` adds: it is the same array, so every read still
 * works and no write does. The message names the fix rather than the rule,
 * because the caller is almost always holding a mutable array that widened on
 * the way in — the parameter's annotation is what has to change, not the call.
 */
export const readonlyWriteMessage = (ctx: CheckContext, receiver: i32, what: string): string => {
  const mutable = ctx.table.typeName(ctx.table.arrayOf(ctx.table.refOf(receiver)))
  return `Cannot ${what} ${ctx.table.typeName(receiver)} (declare it ${mutable} to write through it)`
}

/** `a[i] = v` and `a[i] op= v`. */
export const checkIndexAssignment = (ctx: CheckContext, expr: Node, scope: Scope): i32 => {
  if (isArgvExpression(ctx, expr.children[0].children[0], scope)) {
    // At the `process.argv` itself, parentheses stepped through, where stage0
    // puts it (`checkProcessArgv` in stage0's `src/checker/io.ts`).
    return ctx.errorType(unwrapParens(expr.children[0].children[0]), "`process.argv` is read-only")
  }
  const elem = checkIndex(ctx, expr.children[0], scope)
  ctx.program.nodeTypes[expr.children[0].id] = elem
  const target = ctx.program.nodeTypes[expr.children[0].children[0].id]
  if (ctx.table.isReadonlyArray(target)) {
    return ctx.errorType(expr.children[0], readonlyWriteMessage(ctx, target, "assign to an element of"))
  }
  const op = expr.text
  const value = expr.children[1]
  // WP31 §7: `a[i] op= v` on a ranged element computes in `i32`, and the
  // result enters the range before the store (`rangedStoreOf`).
  const operand = op === "=" ? elem : ctx.table.baseOf(elem)
  const rhs = checkExpression(ctx, value, scope, operand)
  if (elem === T_ERROR || rhs === T_ERROR) {
    return T_ERROR
  }
  if (op === "=") {
    if (!ctx.table.assignable(rhs, elem)) {
      const base = ctx.program.nodeTypes[expr.children[0].children[0].id]
      const spelled = base < 0 ? ctx.table.typeName(ctx.table.arrayOf(elem)) : ctx.table.typeName(base)
      return ctx.errorType(value, `Cannot assign ${ctx.table.typeName(rhs)} to an element of ${spelled}`)
    }
    return elem
  }
  // `a[i] &= v` and the rest of the bitwise family: the element is the target,
  // so the operand rule is `&`'s and the words are a local's.
  if (isBitwiseCompound(op)) {
    return checkBitwiseAssignOperands(ctx, expr, operand, rhs) === T_ERROR ? T_ERROR : elem
  }
  if (!isNumeric(operand) || rhs !== operand) {
    const a = ctx.table.typeName(operand)
    return ctx.errorType(
      expr,
      // The token as it was written, `*=` and not `*`: stage0's element path
      // names the compound one (stage0's `src/checker/arrays.ts`), as its local and
      // field paths do (WP19 §A2).
      `Operator \`${op}\` requires two operands of the same numeric type, got ${a} and ${ctx.table.typeName(rhs)}`
    )
  }
  return elem
}

export const checkArrayProperty = (ctx: CheckContext, expr: Node, receiver: i32): i32 => {
  if (expr.text === "length") {
    return ctx.numberType()
  }
  ctx.errorAtProperty(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`)
  return T_ERROR
}

/**
 * WP33 R2: the typed-array name `expr` is spelled with, or `""`. The four
 * names are the same type as `T[]` (`typedArrayElement`), so the answer is
 * read from the program text rather than the type: `new Float64Array(n)`
 * itself, a binding whose `Local.typedArray` says so, a field declared with
 * the name, or a call whose callee declares it as the return type. TypeScript
 * gives each of those the typed array's type and so no `push` or `pop`, and
 * these are the receivers docs/LANGUAGE.md lists.
 */
export const typedArraySpelling = (ctx: CheckContext, expr: Node, scope: Scope): string => {
  const e = unwrapParens(expr)
  if (e.kind === N_NEW) {
    const callee = e.children[0]
    return callee.kind === N_IDENT && typedArrayElement(callee.text) >= 0 ? callee.text : ""
  }
  if (e.kind === N_IDENT) {
    const local = scope.lookup(e.text)
    return local === null ? "" : local.typedArray
  }
  if (e.kind === N_MEMBER) {
    // A receiver with no recorded type (`Kind.A`, an enum) is not a struct.
    const holder = ctx.program.nodeTypes[e.children[0].id]
    if (holder < 0) {
      return ""
    }
    const owner = ctx.program.struct(ctx.table.nameOf(ctx.table.stripNull(holder)))
    if (owner === null) {
      return ""
    }
    const field = owner.field(e.text)
    if (field === null || field.decl.kind !== N_FIELD) {
      return ""
    }
    return annotationSpelling(ctx, owner.origin === ctx.source, field.decl.children[1])
  }
  if (e.kind === N_CALL) {
    const callee = ctx.program.nodeCallees[e.id]
    if (callee === null || callee.decl.kind === N_CONSTRUCTOR || callee.decl.children.length < 3) {
      return ""
    }
    return annotationSpelling(ctx, callee.definedIn(ctx.source), callee.decl.children[2])
  }
  return ""
}

/**
 * WP33 R2: the typed-array name a type annotation spells, or `""`: the name
 * itself, in parentheses, as the one member of `| null`, or behind a `type`
 * alias. `local` says the annotation is written in the module being checked,
 * whose names `ctx` resolves; one read from another module's declaration is
 * matched only by the four names, since its aliases are that module's.
 */
export const annotationSpelling = (ctx: CheckContext, local: boolean, node: Node): string => {
  let program: CheckedProgram | null = local ? ctx.program : null
  let at = node
  // An alias names another type, which may be an alias too; a cycle is
  // refused where aliases are resolved, and the bound stops this walk on one.
  let hops = 0
  while (hops < 16) {
    if (at.kind === N_TYPE_PAREN) {
      at = at.children[0]
    } else if (at.kind === N_TYPE_UNION) {
      const members = at.children
      if (members.length !== 2 || (members[0].kind === N_TYPE_NULL) === (members[1].kind === N_TYPE_NULL)) {
        return ""
      }
      at = members[0].kind === N_TYPE_NULL ? members[1] : members[0]
    } else if (at.kind === N_TYPE_REF && at.children[0].children.length === 0) {
      if (typedArrayElement(at.text) >= 0) {
        return at.text
      }
      if (program === null || (program === ctx.program && ctx.typeBindings.has(at.text))) {
        return ""
      }
      const alias = program.alias(at.text)
      if (alias === null) {
        return ""
      }
      program = alias.home.program
      at = alias.decl.children[1]
    } else {
      return ""
    }
    hops = hops + 1
  }
  return ""
}

/** `a.push(v)`, `a.pop()`, `a.indexOf(v)`, `a.join(sep)`, `a.set(b, at)`, `a.fill(v, from, to)`. */
export const checkArrayMethod = (
  ctx: CheckContext,
  call: Node,
  access: Node,
  args: Node,
  receiver: i32,
  scope: Scope
): i32 => {
  const name = access.text
  if ((name === "push" || name === "pop") && isArgvExpression(ctx, access.children[0], scope)) {
    return ctx.errorType(unwrapParens(access.children[0]), "`process.argv` is read-only")
  }
  if (isArrayWriteMethod(name) && ctx.table.isReadonlyArray(receiver)) {
    return ctx.errorType(call, readonlyWriteMessage(ctx, receiver, `\`${name}\` through`))
  }
  if (name === "push" || name === "pop") {
    const alias = typedArraySpelling(ctx, access.children[0], scope)
    if (alias.length > 0) {
      ctx.errorAtProperty(
        access,
        `\`${name}\` is not a method of \`${alias}\`, whose length is fixed: declare it \`${ctx.table.typeName(receiver)}\` to push and pop`
      )
      return T_ERROR
    }
  }
  const elem = ctx.table.refOf(receiver)
  const spelled = ctx.table.typeName(receiver)
  // `xs.push(3)` and `xs.indexOf(3)` give a bare literal the element type — but
  // only when the receiver is a plain identifier. stage0 reaches that rule
  // through `calleeName`, which names `xs.push` and gives up on `b.xs.push`
  // (its receiver is not an identifier), so `b.xs.push(0)` in f64 mode is an
  // f64 pushed onto an `i32[]` there and was accepted here
  // (`reject_push_field_literal`, WP19 §A3).
  // A ranged element is the exception (WP31 §6): the range is a sink the
  // pushed value enters, not a width, so it reaches the argument whatever the
  // receiver is spelled like.
  const elemContext = access.children[0].kind === N_IDENT || ctx.table.isRanged(elem) ? elem : -1
  if (name === "push") {
    if (!checkBuiltinArity(ctx, call, "push", args, 1)) {
      return ctx.numberType()
    }
    const got = checkExpression(ctx, args.children[0], scope, elemContext)
    if (got !== T_ERROR && !ctx.table.assignable(got, elem)) {
      ctx.error(args.children[0], `Cannot push ${ctx.table.typeName(got)} onto ${spelled}`)
    }
    return ctx.numberType()
  }
  if (name === "pop") {
    // There is no `undefined`, so an empty array panics rather than adding
    // a second return type; the check is the one `a[i]` already pays for.
    checkBuiltinArity(ctx, call, "pop", args, 0)
    return elem
  }
  if (name === "indexOf") {
    if (!checkBuiltinArity(ctx, call, "indexOf", args, 1)) {
      return ctx.numberType()
    }
    // `indexOf` only compares, so a ranged element is looked for as its base:
    // asking for a value outside the range finds nothing, and is not an entry.
    const probe = ctx.table.baseOf(elem)
    const got = checkExpression(
      ctx,
      args.children[0],
      scope,
      access.children[0].kind === N_IDENT ? probe : -1
    )
    if (got !== T_ERROR && !ctx.table.assignable(got, probe)) {
      const want = ctx.table.typeName(elem)
      ctx.error(
        args.children[0],
        `\`indexOf\` expects ${want} (the element type of ${spelled}), got ${ctx.table.typeName(got)}`
      )
    }
    return ctx.numberType()
  }
  if (name === "join") {
    // `string[]` only: that is the shape that joins in one pass over the
    // lengths and one memcpy per part. Converting elements would allocate per
    // element, which is the quadratic shape `join` exists to avoid.
    if (elem !== T_STRING) {
      ctx.errorAtProperty(
        access,
        `\`join\` requires string[], got ${spelled} (build the parts with template literals first)`
      )
      return T_ERROR
    }
    if (args.children.length > 1) {
      ctx.error(call, `\`join\` expects 0 or 1 arguments, got ${args.children.length}`)
    } else if (args.children.length === 1) {
      const got = checkExpression(ctx, args.children[0], scope, T_STRING)
      if (got !== T_ERROR && got !== T_STRING) {
        ctx.error(args.children[0], `\`join\` expects string, got ${ctx.table.typeName(got)}`)
      }
    }
    return T_STRING
  }
  if (name === "set" || name === "fill") {
    return checkBulkMethod(ctx, call, access, args, receiver, scope)
  }
  ctx.errorAtProperty(access, `Unknown method \`${name}\` on ${spelled} (supported: ${ARRAY_METHODS})`)
  return T_ERROR
}

/**
 * WP34 N2: `dst.set(src, offset)` and `a.fill(value, start, end)`, the two
 * bulk writes, with `TypedArray.prototype`'s meaning. Both are admitted on an
 * array of numbers only — a `u8[]` packet above all, but any width, and a
 * ranged integer too — because an element there is a fixed-size value, so the
 * lowering is one `memmove`, `memcpy` or `memset` of bytes. A string, a class
 * or a record element is a pointer or a struct, where a byte copy would share
 * or tear what the language says is copied whole.
 *
 * Both are statements, as `writeFileSync` is: `set` answers `undefined` in
 * JavaScript, and `fill` answers its receiver, which a program already holds,
 * so refusing the value keeps the two readings identical at no cost.
 */
const checkBulkMethod = (
  ctx: CheckContext,
  call: Node,
  access: Node,
  args: Node,
  receiver: i32,
  scope: Scope
): i32 => {
  const name = access.text
  const elem = ctx.table.refOf(receiver)
  const spelled = ctx.table.typeName(receiver)
  requireStatementPosition(ctx, call, name)
  if (!isNumeric(ctx.table.baseOf(elem))) {
    ctx.errorAtProperty(
      access,
      `\`${name}\` copies bytes, so it needs an array whose elements are numbers (\`u8[]\`, \`i32[]\`, \`f64[]\`, ...), got ${spelled}`
    )
    return T_VOID
  }
  const count = args.children.length
  if (name === "set") {
    if (count < 1 || count > 2) {
      ctx.error(call, `\`set\` expects 1 or 2 arguments, got ${count}`)
      return T_VOID
    }
    const source = args.children[0]
    const got = checkExpression(ctx, source, scope, ctx.table.arrayOf(elem))
    // The source is read, so a `readonly` array may be one; its elements must
    // be the receiver's own type, which is what makes the copy one `memmove`
    // with no conversion and a ranged source already in the receiver's range.
    if (got !== T_ERROR && (!ctx.table.isArray(got) || ctx.table.refOf(got) !== elem)) {
      ctx.error(
        source,
        `\`set\` copies from an array of the receiver's element type, so it expects ${ctx.table.typeName(ctx.table.arrayOf(elem))}, got ${ctx.table.typeName(got)}`
      )
    }
    if (count === 2) {
      checkIndexArgument(ctx, args.children[1], scope, "set")
    }
    ctx.program.nodeDisjointCopy[call.id] = disjointCopy(ctx, access.children[0], source)
    return T_VOID
  }
  if (count < 1 || count > 3) {
    ctx.error(call, `\`fill\` expects 1 to 3 arguments, got ${count}`)
    return T_VOID
  }
  // The value enters every slot, so it is checked the way `push` checks what
  // it stores: a bare literal takes the element type, and a ranged element is
  // a sink its value enters once, before the fill (WP31 §6).
  const value = args.children[0]
  const got = checkExpression(ctx, value, scope, elem)
  if (got !== T_ERROR && !ctx.table.assignable(got, elem)) {
    const want = ctx.table.typeName(elem)
    ctx.error(
      value,
      `\`fill\` expects ${want} (the element type of ${spelled}), got ${ctx.table.typeName(got)}`
    )
  }
  let i = 1
  while (i < count) {
    checkIndexArgument(ctx, args.children[i], scope, "fill")
    i = i + 1
  }
  return T_VOID
}

/**
 * WP34 N2: whether the two arrays of `dst.set(src)` are proven to own
 * different element buffers, which is what lets the copy be a `memcpy`.
 *
 * Two shapes prove it, and nothing else is trusted. An operand that is itself
 * an array literal or a `new` allocates its buffer during the call, so no
 * other array can reach it yet. And two different `const` locals that were
 * each initialised with a fresh allocation (`Local.fresh`) each own the only
 * binding of their buffer: an alias of either would be a second name, and a
 * second name is never fresh. A parameter, a field, a `let` and the same local
 * on both sides are all "not proven", which is a `memmove` and never wrong.
 */
const disjointCopy = (ctx: CheckContext, receiver: Node, source: Node): boolean => {
  if (isFreshArrayExpression(receiver) || isFreshArrayExpression(source)) {
    return true
  }
  const to = freshLocal(ctx, receiver)
  const from = freshLocal(ctx, source)
  return to !== null && from !== null && to !== from
}

/** An array literal or a `new`, whose buffer is allocated where it is written. */
export const isFreshArrayExpression = (expr: Node): boolean => {
  const e = unwrapParens(expr)
  return e.kind === N_ARRAY || e.kind === N_NEW
}

/** The `const` local `expr` names when that local holds a fresh allocation, else `null`. */
const freshLocal = (ctx: CheckContext, expr: Node): Local | null => {
  const e = unwrapParens(expr)
  if (e.kind !== N_IDENT) {
    return null
  }
  const local = ctx.program.nodeLocals[e.id]
  return local !== null && local.fresh ? local : null
}

/**
 * `new Array<T>(n)` and the typed-array aliases. Answers -1 when `name` is
 * not an array constructor, so `checkNew` can fall through to the classes.
 */
export const checkNewArray = (ctx: CheckContext, expr: Node, name: string, scope: Scope): i32 => {
  const typeArgs = expr.children[1]
  const args = expr.children[2]
  let elem = -1
  if (name === "Array") {
    if (typeArgs.children.length !== 1) {
      return ctx.errorType(expr, "`new Array` needs exactly one type argument, e.g. `new Array<number>(n)`")
    }
    elem = resolveType(typeArgs.children[0], ctx)
    if (rejectForeignPointer(ctx, elem, "an array element", typeArgs.children[0])) {
      return T_ERROR
    }
  } else {
    const alias = typedArrayElement(name)
    if (alias < 0) {
      return -1
    }
    if (typeArgs.children.length > 0) {
      const spelled = ctx.table.typeName(alias)
      return ctx.errorType(
        expr,
        `\`new ${name}\` takes no type argument (it is \`new Array<${spelled}>(n)\`)`
      )
    }
    elem = alias
  }
  if (elem === T_VOID) {
    return ctx.errorType(expr, "Array elements cannot be void")
  }
  // Zero-filling is a valid value for scalars and for `T | null` — a zero
  // pointer *is* `null` — but a zeroed plain string or array would be a null
  // value the language has no way to represent or to check for.
  if (ctx.table.isPointer(elem)) {
    const spelled = ctx.table.typeName(elem)
    return ctx.errorType(
      expr,
      `\`new Array<${spelled}>(n)\` would zero-fill with null ${spelled} values; build it with \`[]\` and \`push\` instead`
    )
  }
  // WP31: a zero is a value of a range only when the range holds it, and a
  // zero-filled `integer<1, 9>[]` would hold values its type says it cannot.
  if (ctx.table.isRanged(elem) && (ctx.table.rangeLo(elem) > 0 || ctx.table.rangeHi(elem) < 0)) {
    const spelled = ctx.table.typeName(elem)
    return ctx.errorType(
      expr,
      `\`new Array<${spelled}>(n)\` would zero-fill with 0, which is outside the range; build it with \`[]\` and \`push\` instead`
    )
  }
  if (args.children.length !== 1) {
    return ctx.errorType(
      expr,
      `\`new Array<T>(n)\` expects exactly 1 argument (the length), got ${args.children.length}`
    )
  }
  const length = checkExpression(ctx, args.children[0], scope, ctx.numberType())
  if (length !== T_ERROR && !isNumeric(length)) {
    ctx.error(args.children[0], `Array length must be a number, got ${ctx.table.typeName(length)}`)
  }
  return ctx.table.arrayOf(elem)
}

// ---- WP15 §2a: element references ------------------------------------------------

// The rule that makes contiguous storage safe: an element reference may not be
// held across a mutation of the array it came from (stage0's `src/checker/arrays.ts`,
// where the whole argument is written out).
//
// An array of classes is one block of objects, so `ps[i]` hands out a pointer
// *into* that block. `push` may move the block and `pop` hands the slot back to
// the next `push`, so a reference taken beforehand names memory that is no
// longer the element. The analysis is a source-order walk of one body with a
// loop pre-scanned, because a mutation at the bottom of a loop reaches a
// reference taken at the top on the next pass.

/** The array root a reference or a mutation names; the empty string when it cannot be named. */
const UNNAMED: string = ""

/** One array a call may change the length of, named for the message. */
class Mutation {
  root: string
  /** The element class, so an unnameable receiver cannot invalidate an unrelated array. */
  elem: string
  what: string

  constructor(root: string, elem: string, what: string) {
    this.root = root
    this.elem = elem
    this.what = what
  }
}

/** A live element reference: the local naming it, the array it points into, what invalidated it. */
class ElementRef {
  local: Local
  array: string
  elem: string
  arrayText: string
  /** The mutation that may have moved the storage, or the empty string while the reference is good. */
  invalidatedBy: string
  /**
   * A whole-slot store into the array since the reference was last read, or
   * `null`. Only an observing walk sets it (`slotOverwrites`): the store is
   * legal, and what it records is a difference from TypeScript, not an error.
   */
  overwrittenBy: Node | null
  /**
   * The reference points at a slot still inside the array: `a[i]` or a
   * `for ... of` variable. `a.pop()` hands out the slot it dropped, which no
   * in-bounds store can reach, so a store never overwrites what it reads.
   */
  inBounds: boolean

  constructor(local: Local, array: string, elem: string, arrayText: string) {
    this.local = local
    this.array = array
    this.elem = elem
    this.arrayText = arrayText
    this.invalidatedBy = ""
    this.overwrittenBy = null
    this.inBounds = true
  }

  /** Whether a change to `root`'s `elem` slots may reach this reference. */
  reachedBy(root: string, elem: string): boolean {
    return this.elem === elem && (root === UNNAMED || this.array === UNNAMED || this.array === root)
  }
}

/**
 * NL8004's fact: `store` (`ps[i] = q`) wrote a whole slot of the array the
 * element reference `reference` points into while it was live, and `read` is
 * the first use of `reference` after it. Natively `reference` then reads what
 * the store wrote, because it points at the slot; under TypeScript it still
 * holds the object the slot held before.
 */
export class SlotOverwrite {
  store: Node
  reference: Local
  read: Node

  constructor(store: Node, reference: Local, read: Node) {
    this.store = store
    this.reference = reference
    this.read = read
  }
}

/** `xs`, `this.bodies`, `a.b.c` — how two references are told apart. */
export const referenceRoot = (expr: Node): string => {
  const inner = unwrapParens(expr)
  if (inner.kind === N_IDENT) {
    return inner.text
  }
  if (inner.kind === N_THIS) {
    return "this"
  }
  if (inner.kind === N_MEMBER) {
    const base = referenceRoot(inner.children[0])
    return base === UNNAMED ? UNNAMED : `${base}.${inner.text}`
  }
  return UNNAMED
}

/**
 * The class `expr`'s slots hold inline, or the empty string when `expr` is not
 * an array that stores its elements by value. The *name* is what two arrays are
 * compared by when one of them cannot be named: element types are exact here,
 * so a `FunctionSig[]` and an `ImportBinding[]` are never the same array.
 */
export const inlineArrayElement = (program: CheckedProgram, table: TypeTable, expr: Node): string => {
  const type = program.nodeTypes[expr.id]
  if (type < 0 || !table.isArray(type)) {
    return ""
  }
  const info = inlineElementStruct(program, table, table.refOf(type))
  return info === null ? "" : info.name
}

/** How the root is spelled in a message; an unnameable receiver borrows the type's name. */
const rootText = (program: CheckedProgram, table: TypeTable, expr: Node): string => {
  const root = referenceRoot(expr)
  if (root !== UNNAMED) {
    return root
  }
  const type = program.nodeTypes[expr.id]
  return type < 0 ? "the array" : table.typeName(type)
}

/** The array `expr` reads an element of (`a[i]`, `a.pop()`), or `null`. */
const elementSource = (program: CheckedProgram, table: TypeTable, expr: Node): Node | null => {
  const inner = unwrapParens(expr)
  if (inner.kind === N_INDEX && inlineArrayElement(program, table, inner.children[0]) !== "") {
    return inner.children[0]
  }
  if (inner.kind === N_CALL && inner.children[0].kind === N_MEMBER && inner.children[0].text === "pop") {
    const receiver = inner.children[0].children[0]
    if (inlineArrayElement(program, table, receiver) !== "") {
      return receiver
    }
  }
  return null
}

/**
 * Every inline-element array this call may grow or shorten: the receiver of a
 * `push` / `pop`, and every mutable array argument of a user call, since the
 * callee is free to push through it. A `readonly T[]` parameter is exactly the
 * promise that it does not, and is skipped.
 */
const collectMutations = (program: CheckedProgram, table: TypeTable, call: Node, out: Mutation[]): void => {
  if (call.children[0].kind === N_MEMBER) {
    const method = call.children[0].text
    const receiver = call.children[0].children[0]
    const elem = inlineArrayElement(program, table, receiver)
    if ((method === "push" || method === "pop") && elem !== "") {
      const args = method === "push" ? "..." : ""
      out.push(
        new Mutation(
          referenceRoot(receiver),
          elem,
          `${rootText(program, table, receiver)}.${method}(${args})`
        )
      )
    }
  }
  const callee = program.nodeCallees[call.id]
  if (callee === null) {
    return
  }
  const offset = callee.owner === null ? 0 : 1
  const args = call.children[1]
  let i = 0
  while (i < args.children.length) {
    const arg = args.children[i]
    const elem = inlineArrayElement(program, table, arg)
    const at = i + offset
    if (elem !== "" && at < callee.paramTypes.length && !table.isReadonlyArray(callee.paramTypes[at])) {
      out.push(new Mutation(referenceRoot(arg), elem, `${callee.sourceName}(...)`))
    }
    i = i + 1
  }
}

/**
 * The array a whole-slot store writes into — `ps` of `ps[i] = q` when `ps`
 * stores its elements inline — or `null`. A field store `ps[i].x = 1` is not
 * one: it writes into the element a reference points at, in both readings.
 */
export const slotStoreArray = (program: CheckedProgram, table: TypeTable, node: Node): Node | null => {
  if (node.kind !== N_BINARY || node.text !== "=") {
    return null
  }
  const target = unwrapParens(node.children[0])
  if (target.kind !== N_INDEX || !storesInlineElements(program, table, target.children[0])) {
    return null
  }
  return target.children[0]
}

/**
 * The walk's state, a class because Nish-0 has no closures (as `PerfWalk` is).
 *
 * It runs in one of two modes. The checker's (`ctx` set) reports a reference
 * used after a mutation that may have moved it. The observing one (`ctx`
 * `null`, `overwrites` set) runs over a body that has already checked, for the
 * portability pass, and records every `SlotOverwrite` instead; the references
 * it tracks, and when each one dies, are the same in both.
 */
class RefWalk {
  program: CheckedProgram
  table: TypeTable
  ctx: CheckContext | null
  live: ElementRef[]
  /** One report per body: `ctx.error` suppresses the rest anyway, and stage0 stops here too. */
  reported: boolean
  /** What an observing walk has found; `null` in the checker's, which skips that work. */
  overwrites: SlotOverwrite[] | null
  /**
   * The observing walk's `aliasedRecordElements`: a store into an array of one
   * of these elements is taken to reach every reference of that element type,
   * whatever the array is called. Empty in the checker's walk, whose rule this
   * must not widen.
   */
  aliased: StringSet

  constructor(
    program: CheckedProgram,
    table: TypeTable,
    ctx: CheckContext | null,
    overwrites: SlotOverwrite[] | null,
    aliased: StringSet
  ) {
    this.program = program
    this.table = table
    this.ctx = ctx
    this.live = []
    this.reported = false
    this.overwrites = overwrites
    this.aliased = aliased
  }

  report(node: Node, message: string): void {
    const ctx = this.ctx
    if (ctx !== null) {
      ctx.error(node, message)
    }
    this.reported = true
  }

  /** Forget every reference declared since `depth`: its block has ended. */
  dropTo(depth: i32): void {
    while (this.live.length > depth) {
      this.live.pop()
    }
  }

  /** Mark every live reference the mutation may have invalidated. */
  invalidate(m: Mutation): void {
    let i = 0
    while (i < this.live.length) {
      const ref = this.live[i]
      if (ref.invalidatedBy === "" && ref.reachedBy(m.root, m.elem)) {
        this.live[i].invalidatedBy = m.what
      }
      i = i + 1
    }
  }

  /**
   * When `node` is a whole-slot store and this walk observes, mark every live
   * reference it may have overwritten. Which slot is not asked: `ps[i] = q` and
   * `r = ps[j]` are taken to meet whatever `i` and `j` are, the conservative
   * answer.
   */
  overwrite(node: Node): void {
    if (this.overwrites === null) {
      return
    }
    const array = slotStoreArray(this.program, this.table, node)
    if (array === null) {
      return
    }
    const elem = inlineArrayElement(this.program, this.table, array)
    const root = this.aliased.has(elem) ? UNNAMED : referenceRoot(array)
    let i = 0
    while (i < this.live.length) {
      const ref = this.live[i]
      if (ref.inBounds && ref.overwrittenBy === null && ref.reachedBy(root, elem)) {
        this.live[i].overwrittenBy = node
      }
      i = i + 1
    }
  }

  /**
   * The pre-scan of a loop: every mutation anywhere inside `node` into `out`,
   * and every whole-slot store marked as it is found.
   */
  mutationsWithin(node: Node, out: Mutation[]): void {
    if (node.kind === N_CALL) {
      collectMutations(this.program, this.table, node, out)
    }
    this.overwrite(node)
    for (const child of node.children) {
      this.mutationsWithin(child, out)
    }
  }

  visit(node: Node): void {
    if (node.kind === N_IDENT) {
      this.visitIdentifier(node)
      return
    }
    if (node.kind === N_BLOCK || node.kind === N_CASE || node.kind === N_DEFAULT) {
      const depth = this.live.length
      this.visitChildren(node)
      this.dropTo(depth)
      return
    }
    if (node.kind === N_FOR || node.kind === N_FOR_OF || node.kind === N_WHILE || node.kind === N_DO) {
      this.visitLoop(node)
      return
    }
    if (node.kind === N_CALL) {
      this.visitCall(node)
      return
    }
    if (node.kind === N_VAR_DECL) {
      this.visitDeclaration(node)
      return
    }
    this.visitChildren(node)
    // The store happens after both sides are evaluated, so a reference read
    // on its right-hand side is read before it is overwritten.
    this.overwrite(node)
  }

  visitChildren(node: Node): void {
    for (const child of node.children) {
      this.visit(child)
    }
  }

  visitIdentifier(node: Node): void {
    const local = this.program.nodeLocals[node.id]
    const overwrites = this.overwrites
    if (local === null || (this.reported && overwrites === null)) {
      return
    }
    let i = 0
    while (i < this.live.length) {
      const ref = this.live[i]
      if (ref.local !== local) {
        i = i + 1
        continue
      }
      const store = ref.overwrittenBy
      if (store !== null && overwrites !== null) {
        overwrites.push(new SlotOverwrite(store, local, node))
        this.live[i].overwrittenBy = null
      }
      if (ref.invalidatedBy !== "" && !this.reported) {
        this.report(
          node,
          `\`${ref.local.name}\` refers to an element of \`${ref.arrayText}\`, and \`${ref.invalidatedBy}\` may move or reuse that storage; index \`${ref.arrayText}\` again afterwards rather than holding the element across it`
        )
        return
      }
      i = i + 1
    }
  }

  visitLoop(node: Node): void {
    // Source order is not execution order here: a mutation at the bottom of the
    // body reaches a reference taken at the top on the next pass.
    const found: Mutation[] = []
    this.mutationsWithin(node, found)
    for (const m of found) {
      this.invalidate(m)
    }
    const depth = this.live.length
    // `for (const p of ps)` binds an element reference too. It is re-derived
    // from the header at the top of every pass, so it starts each iteration
    // valid and is only invalidated by a mutation inside the body.
    if (node.kind === N_FOR_OF) {
      const iterable = node.children[1]
      const elem = inlineArrayElement(this.program, this.table, iterable)
      const decl = node.children[0].children[0].children[0]
      const local = this.program.nodeLocals[decl.id]
      if (elem !== "" && local !== null) {
        this.live.push(
          new ElementRef(local, referenceRoot(iterable), elem, rootText(this.program, this.table, iterable))
        )
      }
    }
    this.visitChildren(node)
    this.dropTo(depth)
  }

  visitCall(node: Node): void {
    this.visitChildren(node)
    const found: Mutation[] = []
    collectMutations(this.program, this.table, node, found)
    for (const m of found) {
      // `xs.push(xs[0])`: the argument is read before `nish_array_grow` runs,
      // and the copy into the new slot reads it after.
      if (m.root !== UNNAMED && !this.reported) {
        for (const arg of node.children[1].children) {
          const source = elementSource(this.program, this.table, arg)
          if (source !== null && referenceRoot(source) === m.root && !this.reported) {
            this.report(
              arg,
              `\`${m.what}\` reads an element of \`${m.root}\`, and the push may move that storage first; copy the fields you need into locals before pushing`
            )
          }
        }
      }
      this.invalidate(m)
    }
  }

  visitDeclaration(node: Node): void {
    this.visitChildren(node)
    const local = this.program.nodeLocals[node.id]
    const initializer = node.children[2]
    if (local === null || initializer.kind === N_EMPTY) {
      return
    }
    const source = elementSource(this.program, this.table, initializer)
    if (source === null) {
      return
    }
    const elem = inlineArrayElement(this.program, this.table, source)
    if (elem !== "") {
      const ref = new ElementRef(
        local,
        referenceRoot(source),
        elem,
        rootText(this.program, this.table, source)
      )
      ref.inBounds = unwrapParens(initializer).kind === N_INDEX
      this.live.push(ref)
    }
  }
}

/**
 * WP15 §2a. Reported after the body has checked, like the performance
 * warnings, so every type and binding the walk reads is already recorded.
 */
export const checkElementReferences = (ctx: CheckContext, body: Node): void => {
  const walk = new RefWalk(ctx.program, ctx.table, ctx, null, new StringSet())
  walk.visit(body)
}

/**
 * The same walk over a body that has checked cleanly, recording what it saw
 * rather than reporting: every whole-slot store that overwrote an element a
 * live reference then read (NL8004, `src/portability-records.ts`). `program`
 * carries the body's own side tables, as the portability pass installs them,
 * and `aliased` is the body's `aliasedRecordElements`.
 */
export const slotOverwrites = (
  program: CheckedProgram,
  table: TypeTable,
  body: Node,
  aliased: StringSet
): SlotOverwrite[] => {
  const found: SlotOverwrite[] = []
  const walk = new RefWalk(program, table, null, found, aliased)
  walk.visit(body)
  return found
}

/** Whether `value` makes an array no other name can hold yet: a literal or a `new`. */
const isNewArrayValue = (value: Node): boolean => {
  const inner = unwrapParens(value)
  return inner.kind === N_ARRAY || inner.kind === N_NEW
}

/**
 * Whether a use of the record array `node` under `parent` leaves it under its
 * own name: indexed, a member read through it (`length`, `push`), iterated,
 * handed to a call, or assigned a fresh array. Anything else — an initializer,
 * the value of an assignment, a return, a field of a literal — puts the same
 * array under a second name.
 */
const keepsItsName = (parent: Node, node: Node): boolean => {
  const first = unwrapParens(parent.children[0]) === node
  if (parent.kind === N_INDEX || parent.kind === N_MEMBER) {
    return first
  }
  if (parent.kind === N_FOR_OF) {
    return unwrapParens(parent.children[1]) === node
  }
  if (parent.kind === N_BINARY && parent.text === "=" && first) {
    return isNewArrayValue(parent.children[1])
  }
  return parent.kind === N_LIST
}

const collectAliased = (
  program: CheckedProgram,
  table: TypeTable,
  node: Node,
  parent: Node,
  out: StringSet
): void => {
  // An arrow argument's body is a function of its own, walked with its own
  // tables; what it aliases is its business, not the enclosing body's.
  if (node.kind === N_ARROW) {
    return
  }
  if (node.kind === N_IDENT || node.kind === N_MEMBER) {
    const elem = inlineArrayElement(program, table, node)
    if (elem !== "" && !keepsItsName(parent, node)) {
      out.add(elem)
    }
  }
  if (node.kind === N_VAR_DECL) {
    const local = program.nodeLocals[node.id]
    const initializer = node.children[2]
    if (local !== null && initializer.kind !== N_EMPTY && !isNewArrayValue(initializer)) {
      const elem = inlineArrayElement(program, table, initializer)
      if (elem !== "") {
        out.add(elem)
      }
    }
  }
  // A parenthesised use is judged by what is around the parentheses.
  const next = node.kind === N_PAREN ? parent : node
  for (const child of node.children) {
    collectAliased(program, table, child, next, out)
  }
}

/**
 * The element types of the record arrays a body puts under more than one name
 * (`const qs = ps`, `qs = ps`, `this.f = ps`, `return ps`, a binding from a
 * call). Arrays are references, so after that a write through one name is a
 * write through the other, and a rule that tells arrays apart by their
 * spelling would miss it. The portability rows match an array of these
 * elements by its element type instead, the answer an unnameable array
 * already gets. An array handed to a call that keeps it is not seen here.
 */
export const aliasedRecordElements = (program: CheckedProgram, table: TypeTable, body: Node): StringSet => {
  const out = new StringSet()
  for (const child of body.children) {
    collectAliased(program, table, child, body, out)
  }
  return out
}
