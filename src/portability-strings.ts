// The WP33 portability rows for strings (docs/wp33-round-trip.md §3.2): a UTF-8
// offset or code unit that meets an outside fact (NL8001) and a `slice` whose
// bounds are not proven inside its receiver (NL8002).
//
// A string here is its UTF-8 bytes, and every number a string method answers
// counts them: `.length`, the index `indexOf` finds, the index `charCodeAt`
// and `slice` take, and the code `charCodeAt` reads, which is one byte. The
// TypeScript reading counts UTF-16 code units instead, and the two agree on
// every string whose bytes are all ASCII and on no other. That is less of a
// divergence than it sounds. An offset that one string method answers and
// another on the same string takes is consistent in either unit — the scanner
// that finds a `:` and slices after it cuts at the same character both ways —
// so the pass does not warn about offsets as such. It warns where an offset
// leaves the string's own methods and meets a fact that was not counted in
// the same unit: a number a person reads, a count written into the program, a
// code point spelled as a literal, a column.
//
// The `slice` row is the other half of §3.2. `slice` checks its bounds and
// panics outside `[0, length]`; JavaScript clamps them, and counts a negative
// one from the end. The pass asks the WP15 bounds proof (`src/bounds.ts`)
// whether each bound is inside, the same proof that folds the clamp of a
// `substring`, and warns about every bound it could not place.

import { numericLiteralValue } from "./constants"
import { isIdentifierBuiltinCall } from "./emit-builtins"
import { dottedName, isPushCall, unwrapParens } from "./emit-util"
import { isAsciiText } from "./strings"
import {
  FLAG_PREFIX,
  N_ARRAY,
  N_BINARY,
  N_CALL,
  N_CONDITIONAL,
  N_IDENT,
  N_LIST,
  N_MEMBER,
  N_NUMBER,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_STRING,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_UNARY,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { PortabilityFinding, PortabilityWalk } from "./portability"
import { Local } from "./symbols"
import { isFloat, isNumeric, T_BOOL, T_STRING } from "./types"

const NL8001: string = "counts UTF-8 bytes here, and UTF-16 units in TypeScript"
const NL8002: string = "panics here outside its receiver's bounds, where TypeScript clamps"

/** What a source answers: nothing of interest, a byte offset or count, or one byte's code. */
const NOT_A_SOURCE: i32 = 0
const OFFSET: i32 = 1
const CODE_UNIT: i32 = 2

/**
 * The strings rows, asked about one node at a time.
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
 * finding repeated at one node with one message is kept once.
 *
 * **NL8001**, exactly. A *source* is `s.length`, `s.indexOf(t)` or
 * `s.lastIndexOf(t)` (an offset) or `s.charCodeAt(i)` (a code unit) whose
 * receiver `s` has the type `string` — an array's `.length` is not one — and
 * whose receiver is not provably ASCII (`isProvablyAscii`): a string literal
 * of bytes below 128, a module constant whose folded value is one, a template,
 * `+` or `?:` built only of ASCII parts and number or boolean holes, or a
 * local declared in this body with an initialiser whose every written value
 * is one of those, the local itself included (`s = s + "x"`).
 * From a source the value is followed outward through parentheses, `toI32` /
 * `toI64` / `toF64`, either arm of a `?:`, and arithmetic (`+ - * / %` and the
 * bitwise operators) with an operand that is not a literal; and into a local
 * — a declaration or a plain `=` whose value it is — and then through every
 * read of that local in the body, the same way. It is reported, at the source
 * or at the read of a local that holds it, where it ends:
 *
 * - as an argument of `console.log` or `console.error`, or in a template
 *   literal's hole (it is printed);
 * - as the value `return`ed by, or the concise body of, the entry module's
 *   `main` (it is the exit code);
 * - as the value stored into a field or an element (`o.f = n`, `a[i] = n`),
 *   an object literal's property, an array literal's element, or pushed on to
 *   an array (it is stored);
 * - as either operand of a comparison or an arithmetic operator whose other
 *   operand is a number literal, a signed one or a module constant, and whose
 *   value is — for an offset — neither `0` nor `-1`, the two answers every
 *   string gives in both units (`s.length === 0`, `s.indexOf(t) < 0`,
 *   `=== -1`), or — for a code unit — 128 or more, the codes an ASCII byte
 *   never has (a literal below 128 names the same character in both units, and
 *   a byte of a longer UTF-8 sequence is never below it) — except `+ k` on the
 *   offset an `indexOf` or `lastIndexOf` of a provably ASCII needle answers,
 *   for `0 < k <= needle.length`, which steps inside the match and so lands
 *   on the same character in both readings (`needleSpan`);
 * - as the right operand of a `-` whose left operand does not itself hold an
 *   offset: `width - s.length` is the room left in a column, and the column
 *   was not counted in bytes (it pads or aligns output — the language has no
 *   `padStart` or `repeat` to be the site instead).
 *
 * Everything else is quiet: an offset handed to a string method, or to any
 * function, compared with another offset or with a local, or used as a loop
 * bound, stays inside the program's own counting. `lastIndexOf` is not a
 * method the checker accepts today, and is named so that the row does not
 * have to change the day it is.
 *
 * **NL8002**, exactly. `s.slice(a)` or `s.slice(a, b)` on a `string`, where a
 * bound is a negative literal (TypeScript counts it from the end) or is not in
 * `nodeProvenClamp`: `src/bounds.ts` records there each `slice` bound it
 * proves inside `[0, s.length]`, by the proof that folds a `substring` clamp,
 * and records it only. One warning per call, naming the first such bound. An
 * array has no `slice` in the language, so the row reads strings only. The
 * proof does not relate the two bounds, so `s.slice(b, a)` with both inside is
 * quiet, though it panics here where TypeScript answers `""`.
 */
export const stringFindings = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  sliceFinding(walk, node, out)
  const kind = sourceKind(walk, node)
  if (kind === NOT_A_SOURCE || isProvablyAscii(walk, sourceReceiver(node), [])) {
    return
  }
  followValue(new Trail(walk, node, kind, needleSpan(walk, node), out), node, null)
}

// ---- NL8001 ----------------------------------------------------------------

/**
 * One source being followed: the walk, the source node, what
 * kind of number it is, how many bytes of ASCII it is known to point at
 * (`needleSpan`), the locals it has already been followed into — so a
 * value that goes round a loop through `n = n + k` is followed once — and
 * where the findings go.
 */
class Trail {
  walk: PortabilityWalk
  source: Node
  kind: i32
  span: f64
  locals: Local[]
  out: PortabilityFinding[]

  constructor(walk: PortabilityWalk, source: Node, kind: i32, span: f64, out: PortabilityFinding[]) {
    this.walk = walk
    this.source = source
    this.kind = kind
    this.span = span
    this.locals = []
    this.out = out
  }

  /**
   * Report the value at `at` as meeting an outside fact: the source itself, or
   * a read of `holder`, the local it was followed into. The quote is built
   * here, because most sources are never reported and the arena keeps every
   * string it is asked for.
   */
  report(at: Node, holder: Local | null, reason: string): void {
    const source = `\`${this.walk.textOf(this.source)}\``
    const quote = holder === null ? source : `\`${holder.name}\`, which holds ${source},`
    this.out.push(new PortabilityFinding(at, `${quote} ${NL8001}, ${reason}`))
  }
}

/** Whether `node` is a string-valued expression, as the checker typed it. */
const isString = (walk: PortabilityWalk, node: Node): boolean => walk.program.nodeTypes[node.id] === T_STRING

/** Which kind of UTF-8 number `node` answers, if it is a source at all. */
const sourceKind = (walk: PortabilityWalk, node: Node): i32 => {
  if (node.kind === N_MEMBER && node.text === "length" && isString(walk, node.children[0])) {
    return OFFSET
  }
  if (node.kind !== N_CALL) {
    return NOT_A_SOURCE
  }
  const callee = unwrapParens(node.children[0])
  if (callee.kind !== N_MEMBER || !isString(walk, callee.children[0])) {
    return NOT_A_SOURCE
  }
  if (callee.text === "charCodeAt") {
    return CODE_UNIT
  }
  return callee.text === "indexOf" || callee.text === "lastIndexOf" ? OFFSET : NOT_A_SOURCE
}

/**
 * How many bytes an offset is known to point at the start of, all of them
 * ASCII: the length of an `indexOf` or `lastIndexOf` needle that is provably
 * ASCII, and 0 for any other source. Stepping that far past a match stays
 * inside the needle, whose bytes are its code units one for one, so
 * `line.slice(line.indexOf(":") + 1)` cuts at the same character in either
 * reading and is not reported.
 */
const needleSpan = (walk: PortabilityWalk, source: Node): f64 => {
  if (source.kind !== N_CALL || source.children[1].children.length !== 1) {
    return 0
  }
  const method = unwrapParens(source.children[0]).text
  if (method !== "indexOf" && method !== "lastIndexOf") {
    return 0
  }
  const needle = asciiValue(walk, source.children[1].children[0])
  return needle === null ? 0 : toF64(needle.length)
}

/** The string a source counts in: the receiver of its `.length` or its call. */
const sourceReceiver = (source: Node): Node =>
  source.kind === N_MEMBER ? source.children[0] : unwrapParens(source.children[0]).children[0]

/**
 * Whether every string `expr` can be is ASCII, by induction over what the
 * program writes: a literal of ASCII bytes, a module constant whose folded
 * value is one, a template whose text is ASCII and whose holes are numbers,
 * booleans or ASCII strings, a `+` or a `?:` of ASCII strings, or a local
 * declared in this body with an initialiser whose every write — the
 * initialiser and each `=` — is ASCII in turn. `assumed` are the
 * locals already being proved: every value they can hold is built only out of
 * the writes being checked, so assuming them ASCII while checking those
 * writes is the induction step, and it is what lets `s = s + "x"` prove `s`.
 * A parameter, and a local declared without an initialiser, starts with a
 * value from outside and proves nothing.
 */
const isProvablyAscii = (walk: PortabilityWalk, expr: Node, assumed: Local[]): boolean => {
  const e = unwrapParens(expr)
  if (e.kind === N_STRING) {
    return isAsciiText(e.text)
  }
  if (e.kind === N_TEMPLATE) {
    for (const part of e.children) {
      const type = walk.program.nodeTypes[part.id]
      const ascii =
        part.kind === N_TEMPLATE_TEXT
          ? isAsciiText(part.text)
          : isNumeric(type) || type === T_BOOL || isProvablyAscii(walk, part, assumed)
      if (!ascii) {
        return false
      }
    }
    return true
  }
  if (e.kind === N_BINARY && e.text === "+") {
    return isProvablyAscii(walk, e.children[0], assumed) && isProvablyAscii(walk, e.children[1], assumed)
  }
  if (e.kind === N_CONDITIONAL) {
    return isProvablyAscii(walk, e.children[1], assumed) && isProvablyAscii(walk, e.children[2], assumed)
  }
  if (e.kind !== N_IDENT) {
    return false
  }
  if (walk.program.nodeConstants[e.id] !== null) {
    return asciiConstant(walk, e) !== null
  }
  const local = walk.program.nodeLocals[e.id]
  if (local === null) {
    return false
  }
  for (const proving of assumed) {
    if (proving === local) {
      return true
    }
  }
  assumed.push(local)
  const writes: Node[] = []
  if (!writesOf(walk, walk.body, local, writes)) {
    return false
  }
  for (const write of writes) {
    if (!isProvablyAscii(walk, write, assumed)) {
      return false
    }
  }
  return true
}

/**
 * Every value written to `local` under `node`, in source order: its
 * initialiser (`N_EMPTY` when it has none) and the right of each `=`. A
 * string takes no compound assignment, so there is no other way to write one,
 * and a number's `+=` or `++` leaves an offset an offset. Answers whether the
 * declaration was among them, which a parameter's is not: its first value
 * comes from the caller.
 */
const writesOf = (walk: PortabilityWalk, node: Node, local: Local, writes: Node[]): boolean => {
  let declared = false
  if (node.kind === N_VAR_DECL && names(walk, node, local)) {
    writes.push(node.children[2])
    declared = true
  } else if (node.kind === N_BINARY && node.text === "=") {
    const target = unwrapParens(node.children[0])
    if (target.kind === N_IDENT && names(walk, target, local)) {
      writes.push(node.children[1])
    }
  }
  for (const child of node.children) {
    if (writesOf(walk, child, local, writes)) {
      declared = true
    }
  }
  return declared
}

/** The folded value of the module constant `ident` names, when it is a string of ASCII bytes. */
const asciiConstant = (walk: PortabilityWalk, ident: Node): string | null => {
  const constant = walk.program.nodeConstants[ident.id]
  if (constant === null || constant.type !== T_STRING || !constant.folded) {
    return null
  }
  return isAsciiText(constant.textValue) ? constant.textValue : null
}

/**
 * The value of `expr` when the program spells it out and every byte is ASCII:
 * a literal, a module constant, or a `const` local of this body initialised
 * with one of those. `null` for every other expression, including one
 * `isProvablyAscii` accepts without knowing the exact text.
 */
const asciiValue = (walk: PortabilityWalk, expr: Node): string | null => {
  const e = unwrapParens(expr)
  if (e.kind === N_STRING) {
    return isAsciiText(e.text) ? e.text : null
  }
  if (e.kind !== N_IDENT) {
    return null
  }
  if (walk.program.nodeConstants[e.id] !== null) {
    return asciiConstant(walk, e)
  }
  const local = walk.program.nodeLocals[e.id]
  const writes: Node[] = []
  if (local === null || local.mutable || !writesOf(walk, walk.body, local, writes)) {
    return null
  }
  return asciiValue(walk, writes[0])
}

/**
 * Follow the value at `value` — the source, or a read of `holder` — outward
 * until it meets something, and report it there if that something is an
 * outside fact.
 */
const followValue = (trail: Trail, value: Node, holder: Local | null): void => {
  const walk = trail.walk
  let at = value
  while (true) {
    if (at === walk.body) {
      // A concise arrow body is its function's answer.
      if (isEntryMain(walk)) {
        trail.report(value, holder, "and `main` returns it as the exit code")
      }
      return
    }
    const parent = walk.parents.parentOf(at)
    if (parent === null) {
      return
    }
    if (parent.kind === N_PAREN || (parent.kind === N_CONDITIONAL && at !== parent.children[0])) {
      at = parent
    } else if (parent.kind === N_LIST) {
      // An argument: its list's parent is the call it is handed to.
      const call = walk.parents.parentOf(parent)
      if (call === null || call.kind !== N_CALL || call.children[1] !== parent) {
        return
      }
      if (!isConversion(walk, call)) {
        followIntoCall(trail, call, value, holder)
        return
      }
      at = call
    } else if (parent.kind === N_BINARY) {
      if (!followThroughBinary(trail, parent, at, value, holder)) {
        return
      }
      at = parent
    } else {
      followIntoPlace(trail, parent, at, value, holder)
      return
    }
  }
}

/** A value handed to a call: printed by `console`, pushed on to an array, or neither. */
const followIntoCall = (trail: Trail, call: Node, value: Node, holder: Local | null): void => {
  const walk = trail.walk
  const callee = unwrapParens(call.children[0])
  if (callee.kind !== N_MEMBER) {
    return
  }
  const name = dottedName(callee)
  if ((name === "console.log" || name === "console.error") && walk.program.nodeCallees[call.id] === null) {
    trail.report(value, holder, "and it is printed")
  } else if (isPushCall(walk.program, walk.table, call)) {
    trail.report(value, holder, "and it is stored in an array")
  }
}

/** `toI32(x)`, `toI64(x)` or `toF64(x)`: the same count in another type. */
const isConversion = (walk: PortabilityWalk, call: Node): boolean => {
  const name = call.children[0].text
  return (
    isIdentifierBuiltinCall(walk.program, call) && (name === "toI32" || name === "toI64" || name === "toF64")
  )
}

/**
 * A value that is one operand of a binary operator. Answers whether the value
 * goes on outward as the operator's result: it does through arithmetic with
 * anything but a literal, and stops at a comparison, an assignment and a
 * logical operator, reporting what it met there.
 */
const followThroughBinary = (
  trail: Trail,
  binary: Node,
  at: Node,
  value: Node,
  holder: Local | null
): boolean => {
  const walk = trail.walk
  const op = binary.text
  const isLeft = at === binary.children[0]
  const other = isLeft ? binary.children[1] : binary.children[0]
  if (op === "=") {
    if (!isLeft) {
      storeInto(trail, binary.children[0], value, holder)
    }
    return false
  }
  if (!isComparison(op) && !isArithmetic(op)) {
    return false
  }
  if (isNumberLiteral(walk, other)) {
    const literal = numberValue(walk, other)
    if (meetsLiteral(trail.kind, literal) && !(op === "+" && literal > 0 && literal <= trail.span)) {
      const verb = isComparison(op) ? "compared with" : "combined with"
      trail.report(
        value,
        holder,
        `and it is ${verb} \`${walk.textOf(other)}\`, which was not counted in that unit`
      )
    }
    return false
  }
  if (isComparison(op)) {
    return false
  }
  if (op === "-" && !isLeft && trail.kind === OFFSET && !holdsOffset(walk, other, true)) {
    trail.report(value, holder, `and it is taken from \`${walk.textOf(other)}\` to pad or align the output`)
    return false
  }
  return true
}

/** `value` is stored at `target`: a field or an element is outside, a local is followed. */
const storeInto = (trail: Trail, target: Node, value: Node, holder: Local | null): void => {
  const place = unwrapParens(target)
  if (place.kind === N_MEMBER) {
    trail.report(value, holder, "and it is stored in a field")
  } else if (place.kind === N_IDENT) {
    followLocal(trail, trail.walk.program.nodeLocals[place.id])
  } else {
    trail.report(value, holder, "and it is stored in an array")
  }
}

/** The value has reached a node that is not an expression it flows through. */
const followIntoPlace = (trail: Trail, parent: Node, at: Node, value: Node, holder: Local | null): void => {
  if (parent.kind === N_TEMPLATE) {
    trail.report(value, holder, "and it is printed into a template")
  } else if (parent.kind === N_RETURN) {
    if (isEntryMain(trail.walk)) {
      trail.report(value, holder, "and `main` returns it as the exit code")
    }
  } else if (parent.kind === N_ARRAY) {
    trail.report(value, holder, "and it is stored in an array")
  } else if (parent.kind === N_PROPERTY) {
    trail.report(value, holder, "and it is stored in a field")
  } else if (parent.kind === N_VAR_DECL && at === parent.children[2]) {
    followLocal(trail, trail.walk.program.nodeLocals[parent.id])
  }
}

/**
 * Every read of `local` in the body, followed as the value it holds. A read
 * is reported where it is, and names the source it holds, because the caret
 * belongs where the count meets the outside fact.
 */
const followLocal = (trail: Trail, local: Local | null): void => {
  if (local === null) {
    return
  }
  for (const seen of trail.locals) {
    if (seen === local) {
      return
    }
  }
  trail.locals.push(local)
  const reads: Node[] = []
  readsOf(trail.walk, trail.walk.body, local, reads)
  for (const read of reads) {
    followValue(trail, read, local)
  }
}

/** Whether the checker bound `node` to `local`. */
const names = (walk: PortabilityWalk, node: Node, local: Local): boolean => {
  const bound = walk.program.nodeLocals[node.id]
  return bound !== null && bound === local
}

/** The identifiers under `node` that read `local`, in source order; the target of a plain `=` is not one. */
const readsOf = (walk: PortabilityWalk, node: Node, local: Local, reads: Node[]): void => {
  if (node.kind === N_IDENT && names(walk, node, local)) {
    const parent = walk.parents.parentOf(node)
    if (parent === null || parent.kind !== N_BINARY || parent.text !== "=" || parent.children[0] !== node) {
      reads.push(node)
    }
    return
  }
  for (const child of node.children) {
    readsOf(walk, child, local, reads)
  }
}

/**
 * Whether `expr` holds an offset itself, so that subtracting one from it is a
 * distance, not a column: a source, arithmetic on one, or — when
 * `throughLocals` — a local some write gives such a value. A local the
 * program only fills from elsewhere is the outside fact itself. One level of
 * locals is enough to tell `end - s.length` from `width - s.length`, and
 * stopping there is what keeps the question from going round a cycle.
 */
const holdsOffset = (walk: PortabilityWalk, expr: Node, throughLocals: boolean): boolean => {
  const e = unwrapParens(expr)
  if (sourceKind(walk, e) === OFFSET) {
    return true
  }
  if (e.kind === N_BINARY && isArithmetic(e.text)) {
    return holdsOffset(walk, e.children[0], throughLocals) || holdsOffset(walk, e.children[1], throughLocals)
  }
  const local: Local | null = e.kind === N_IDENT && throughLocals ? walk.program.nodeLocals[e.id] : null
  if (local === null) {
    return false
  }
  const writes: Node[] = []
  writesOf(walk, walk.body, local, writes)
  for (const write of writes) {
    if (holdsOffset(walk, write, false)) {
      return true
    }
  }
  return false
}

const isComparison = (op: string): boolean =>
  op === "<" || op === "<=" || op === ">" || op === ">=" || op === "===" || op === "!=="

const isArithmetic = (op: string): boolean =>
  op === "+" ||
  op === "-" ||
  op === "*" ||
  op === "/" ||
  op === "%" ||
  op === "&" ||
  op === "|" ||
  op === "^" ||
  op === "<<" ||
  op === ">>" ||
  op === ">>>"

/** Whether a literal of `value` is a fact from outside for a number of this `kind` (see the JSDoc of `stringFindings`). */
const meetsLiteral = (kind: i32, value: f64): boolean => {
  if (kind === CODE_UNIT) {
    return value >= 128
  }
  return value !== 0 && value !== -1
}

/** A number literal, a signed one, or a module constant of a number type. */
const isNumberLiteral = (walk: PortabilityWalk, expr: Node): boolean => {
  const e = unwrapParens(expr)
  if (e.kind === N_NUMBER) {
    return true
  }
  if (e.kind === N_UNARY && e.flags === FLAG_PREFIX && (e.text === "-" || e.text === "+")) {
    return isNumberLiteral(walk, e.children[0])
  }
  if (e.kind !== N_IDENT) {
    return false
  }
  const constant = walk.program.nodeConstants[e.id]
  return constant !== null && constant.folded && isNumeric(constant.type)
}

/** The value of an expression `isNumberLiteral` accepted. */
const numberValue = (walk: PortabilityWalk, expr: Node): f64 => {
  const e = unwrapParens(expr)
  if (e.kind === N_NUMBER) {
    return numericLiteralValue(e.text)
  }
  if (e.kind === N_UNARY) {
    const operand = numberValue(walk, e.children[0])
    return e.text === "-" ? -operand : operand
  }
  const constant = walk.program.nodeConstants[e.id]
  if (constant === null) {
    return 0
  }
  return isFloat(constant.type) ? constant.floatValue : toF64(constant.intValue)
}

/** Whether the function being walked is the program's entry, `export const main`, as the checker marked it. */
const isEntryMain = (walk: PortabilityWalk): boolean => {
  const main = walk.program.entryMain
  return main !== null && main === walk.sig
}

// ---- NL8002 ----------------------------------------------------------------

/** `s.slice(...)` with a bound TypeScript would clamp or count from the end, where this panics. */
const sliceFinding = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node.kind !== N_CALL) {
    return
  }
  const callee = unwrapParens(node.children[0])
  if (callee.kind !== N_MEMBER || callee.text !== "slice" || !isString(walk, callee.children[0])) {
    return
  }
  // The first bound TypeScript would treat differently, found before any
  // message text is built so that the search allocates nothing.
  let found: Node | null = null
  let negative = false
  for (const bound of node.children[1].children) {
    negative = isNumberLiteral(walk, bound) && numberValue(walk, bound) < 0
    if (negative || !walk.program.nodeProvenClamp[bound.id]) {
      found = bound
      break
    }
  }
  if (found === null) {
    return
  }
  const call = `\`${walk.textOf(node)}\` ${NL8002}`
  const text = walk.textOf(found)
  if (!negative) {
    out.push(
      new PortabilityFinding(
        node,
        `${call}: \`${text}\` is not proven inside \`[0, length]\`, and \`substring\` clamps in both`
      )
    )
    return
  }
  // `-2` is `s.length - 2`; a constant that folds negative is added as it is.
  const receiver = walk.textOf(callee.children[0])
  const literal = unwrapParens(found)
  const spelled =
    literal.kind === N_UNARY && literal.text === "-"
      ? `${receiver}.length - ${walk.textOf(literal.children[0])}`
      : `${receiver}.length + ${text}`
  out.push(
    new PortabilityFinding(
      node,
      `${call}; TypeScript counts \`${text}\` from the end, which \`${spelled}\` spells in both`
    )
  )
}
