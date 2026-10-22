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

import { constructorOf } from "./attributes"
import { proveSliceBounds } from "./bounds"
import { numericLiteralValue } from "./constants"
import { isIdentifierBuiltinCall } from "./emit-builtins"
import { dottedName, isPushCall, unwrapParens } from "./emit-util"
import { isAsciiText } from "./strings"
import {
  FLAG_PREFIX,
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_CALL,
  N_CONDITIONAL,
  N_DO,
  N_FOR,
  N_IDENT,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_STRING,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_UNARY,
  N_VAR_DECL,
  N_WHILE,
  Node,
} from "./nodes"
import { PortabilityFinding, PortabilityWalk } from "./portability"
import { parallelBodyOf, parallelRoleOf } from "./parallel"
import { FunctionSig, PAR_FROM, PAR_MAP, PAR_MAP_NEW, PAR_NONE, PAR_REDUCE } from "./program"
import { Local, sourceLocal, STORAGE_PARAM } from "./symbols"
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
 * rather than inside its parent's, though a name it captures (WP29) is read
 * as the parent's local. `walk` carries the facts
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
 *   a byte of a longer UTF-8 sequence is never below it) — except one `+ k`
 *   on the offset an `indexOf` or `lastIndexOf` of a provably ASCII needle
 *   answers, for `0 < k <= needle.length`: that steps inside the match, so it
 *   is not itself a fact from outside, and the stepped offset is followed on
 *   like any other — quiet into `slice`, reported where it is printed
 *   (`needleSpan`, `isNeedleStep`);
 * - as the right operand of a `-` whose left operand does not itself hold an
 *   offset: `width - s.length` is the room left in a column, and the column
 *   was not counted in bytes (it pads or aligns output — the language has no
 *   `padStart` or `repeat` to be the site instead);
 * - as the index of an element access on anything but a string (`a[n]`: it
 *   picks a different element), or the count `parallelFrom(n, f)` makes;
 * - as a bound of a loop: either operand of a comparison in a `while`, `do`
 *   or `for` condition whose other operand does not hold an offset and is not
 *   the loop's cursor into a string — a local the loop uses as a string's
 *   index or hands to a string's method (`isCursor`), which counts in the
 *   string's own unit;
 * - as the answer of a data-parallel body (`parallelMap`, `parallelMapInto`,
 *   `parallelFrom`: stored in the array it fills; `parallelReduce`: folded
 *   into the value the call answers, which is followed on from the call).
 *
 * The walk crosses functions of this module that are not generic or methods
 * of a generic class, up to `MAX_DEPTH` hops. An offset passed as an argument
 * — to a function, a method or a constructor — is followed through the
 * parameter's reads in the callee and reported at the argument where the
 * callee lets it out, the callee's reason quoted. An offset a function
 * returns, or a lifted arrow answers, is followed from every call of it in
 * the module, and from the parallel call that runs an arrow as its body; a
 * call whose matching argument is provably ASCII is skipped. A name an arrow
 * captures is ASCII when the function hosting it writes only ASCII to it.
 *
 * Everything else is quiet: an offset handed to a string method, compared
 * with another offset or with a cursor, or kept inside a function the walk
 * does not cross, stays inside the program's own counting. `lastIndexOf` is
 * not a method the checker accepts today, and is named so that the row does
 * not have to change the day it is.
 *
 * **NL8002**, exactly. `s.slice(a)` or `s.slice(a, b)` on a `string`, where a
 * bound is a negative literal (TypeScript counts it from the end) or is not in
 * `nodeProvenClamp`: `proveSliceBounds` in `src/bounds.ts`, called here at
 * the root of every body, records there each `slice` bound the proof that
 * folds a `substring` clamp places inside `[0, s.length]` — the pass-2 walk,
 * without the entry facts `src/ranges.ts` adds. One warning per call, naming the first such bound. An
 * array has no `slice` in the language, so the row reads strings only. The
 * proof does not relate the two bounds, so `s.slice(b, a)` with both inside is
 * quiet, though it panics here where TypeScript answers `""`.
 */
export const stringFindings = (walk: PortabilityWalk, node: Node, out: PortabilityFinding[]): void => {
  if (node === walk.body) {
    proveSliceBounds(walk.program, walk.table, walk.opts, walk.body)
  }
  sliceFinding(walk, node, out)
  const kind = sourceKind(walk, node)
  if (kind === NOT_A_SOURCE || isProvablyAscii(walk, sourceReceiver(node), [])) {
    return
  }
  const trail = new Trail(walk, node, kind, needleSpan(walk, node), out)
  trail.param = parameterIndex(walk, sourceReceiver(node))
  followValue(trail, node, null)
}

// ---- NL8001 ----------------------------------------------------------------

/**
 * How many functions a value is followed across, into a callee's parameter or
 * out of a function's answer into its callers, before the pass stops: deep
 * enough for a helper that calls a helper, and the bound that ends recursion.
 */
const MAX_DEPTH: i32 = 4

/**
 * One source being followed: the walk, the source node, what
 * kind of number it is, how many bytes of ASCII it is known to point at
 * (`needleSpan`), the locals it has already been followed into — so a
 * value that goes round a loop through `n = n + k` is followed once — and
 * where the findings go.
 *
 * A value crosses functions two ways. Out of a function's answer it goes on in
 * each caller from the call, under a trail whose `via` is the call (or what
 * the call ran) and `depth` one more, and `param` says which argument the
 * source's receiver was, so a caller that passes a provably ASCII string is
 * skipped. Into a callee's parameter it goes under a trail whose `relay` is
 * where it left the caller: what it meets there is reported at the argument,
 * and the callee's answer goes on from the call.
 */
class Trail {
  walk: PortabilityWalk
  source: Node
  kind: i32
  span: f64
  locals: Local[]
  out: PortabilityFinding[]
  via: Node | null
  verb: string
  param: i32
  depth: i32
  relay: Relay | null

  constructor(walk: PortabilityWalk, source: Node, kind: i32, span: f64, out: PortabilityFinding[]) {
    this.walk = walk
    this.source = source
    this.kind = kind
    this.span = span
    this.locals = []
    this.out = out
    this.via = null
    this.verb = ""
    this.param = -1
    this.depth = 0
    this.relay = null
  }

  /**
   * Report the value at `at` as meeting an outside fact: the source itself, or
   * a read of `holder`, the local it was followed into. The quote is built
   * here, because most sources are never reported and the arena keeps every
   * string it is asked for. In a callee it is reported at the argument the
   * caller passed.
   */
  report(at: Node, holder: Local | null, reason: string): void {
    const relay = this.relay
    if (relay !== null) {
      relay.trail.report(
        relay.value,
        relay.holder,
        `and it is passed to \`${relay.name()}\`, where ${reason.substring(4)}`
      )
      return
    }
    const via = this.via
    const origin = `\`${this.walk.textOf(this.source)}\``
    const source = via === null ? origin : `\`${this.walk.textOf(via)}\`, which ${this.verb} ${origin}`
    const quote =
      holder !== null ? `\`${holder.name}\`, which holds ${source},` : via === null ? source : `${source},`
    this.out.push(new PortabilityFinding(at, `${quote} ${NL8001}, ${reason}`))
  }

  /** The same source, followed on in `walk` from `via`, a call that answers it. */
  derive(walk: PortabilityWalk, via: Node, verb: string, param: i32): Trail {
    const trail = new Trail(walk, this.source, this.kind, this.span, this.out)
    trail.via = via
    trail.verb = verb
    trail.param = param
    trail.depth = this.depth + 1
    return trail
  }
}

/** Where a value left its caller for a callee's parameter: the trail, the argument and the local it was read from, and the call. */
class Relay {
  trail: Trail
  value: Node
  holder: Local | null
  call: Node

  constructor(trail: Trail, value: Node, holder: Local | null, call: Node) {
    this.trail = trail
    this.value = value
    this.holder = holder
    this.call = call
  }

  /** The callee as the caller spells it: `f`, `o.m`, or `new C`. */
  name(): string {
    const callee = this.trail.walk.textOf(this.call.children[0])
    return this.call.kind === N_NEW ? `new ${callee}` : callee
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
 * reading and is not reported, while `console.log(line.indexOf(":") + 1)`
 * still is: the step is no fact, but the printed offset is.
 */
const needleSpan = (walk: PortabilityWalk, source: Node): f64 => {
  if (source.kind !== N_CALL || source.children[1].children.length === 0) {
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
  const local = sourceLocal(walk.program.nodeLocals[e.id])
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
  if (!writesOf(walk, walk.body, local, writes) && !hostWritesOf(walk, local, writes)) {
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
 * `writesOf` for a local an arrow captures (WP29), which is declared in the
 * body the arrow was lifted out of — or in that body's own host — and written
 * there.
 */
const hostWritesOf = (walk: PortabilityWalk, local: Local, writes: Node[]): boolean => {
  let host = walk.sig.captureHost
  while (host !== null) {
    const body = host.body()
    if (body !== null && writesOf(walk, body, local, writes)) {
      return true
    }
    host = host.captureHost
  }
  return false
}

/**
 * Which argument of the function being walked `expr` is, when it is a
 * parameter the body never writes: a caller that passes a provably ASCII
 * string there makes every offset counted in it ASCII too. -1 for anything
 * else. A method's or constructor's `this` is not an argument.
 */
const parameterIndex = (walk: PortabilityWalk, expr: Node): i32 => {
  const e = unwrapParens(expr)
  const local: Local | null = e.kind === N_IDENT ? walk.program.nodeLocals[e.id] : null
  const writes: Node[] = []
  if (local === null || local.storage !== STORAGE_PARAM || local.captureOf !== null) {
    return -1
  }
  writesOf(walk, walk.body, local, writes)
  if (writes.length > 0) {
    return -1
  }
  const names = walk.sig.paramNames
  const first = names.length > 0 && names[0] === "this" ? 1 : 0
  for (let k = first; k < names.length; k++) {
    if (k >= 0 && names[k] === local.name) {
      return k - first
    }
  }
  return -1
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
  followFrom(trail, value, value, holder)
}

/** `followValue` with the value already at `from`, an expression it reached. */
const followFrom = (trail: Trail, value: Node, from: Node, holder: Local | null): void => {
  const walk = trail.walk
  let at = from
  let stepped = false
  while (true) {
    if (at === walk.body) {
      // A concise arrow body is its function's answer.
      followOutOfFunction(trail, value, holder)
      return
    }
    const parent = walk.parents.parentOf(at)
    if (parent === null) {
      return
    }
    if (parent.kind === N_ARROW) {
      // A concise arrow body inside this one: the value is the arrow's answer.
      followOutOfArrow(trail, parent, value, holder)
      return
    }
    if (parent.kind === N_PAREN || (parent.kind === N_CONDITIONAL && at !== parent.children[0])) {
      at = parent
    } else if (parent.kind === N_LIST) {
      // An argument: its list's parent is the call it is handed to.
      const call = walk.parents.parentOf(parent)
      if (call !== null && call.kind === N_NEW && call.children[2] === parent) {
        followIntoParameter(trail, call, at, value, holder)
        return
      }
      if (call === null || call.kind !== N_CALL || call.children[1] !== parent) {
        return
      }
      if (!isConversion(walk, call)) {
        followIntoCall(trail, call, at, value, holder)
        return
      }
      at = call
    } else if (parent.kind === N_BINARY) {
      if (!stepped && isNeedleStep(trail, parent)) {
        // One step inside the match is still an offset, and it is followed
        // on to wherever it goes; it is only the literal that is no fact.
        stepped = true
        at = parent
        continue
      }
      if (!followThroughBinary(trail, parent, at, value, holder)) {
        return
      }
      at = parent
    } else if (parent.kind === N_INDEX) {
      // A string's own index stays in its counting; any other is an element.
      if (at === parent.children[1] && !isString(walk, parent.children[0])) {
        trail.report(value, holder, "and it indexes an array")
      }
      return
    } else {
      followIntoPlace(trail, parent, at, value, holder)
      return
    }
  }
}

/**
 * A value handed to a call as the argument `arg`: printed by `console`, pushed
 * on to an array, counting the elements `parallelFrom` makes, the identity
 * `parallelReduce` folds into its answer, or a parameter of a function of this
 * module, followed there. A string method, and any other callee, is quiet.
 */
const followIntoCall = (trail: Trail, call: Node, arg: Node, value: Node, holder: Local | null): void => {
  const walk = trail.walk
  const callee = unwrapParens(call.children[0])
  const name = callee.kind === N_MEMBER ? dottedName(callee) : ""
  const sig = walk.program.nodeCallees[call.id]
  if ((name === "console.log" || name === "console.error") && sig === null) {
    trail.report(value, holder, "and it is printed")
    return
  }
  if (callee.kind === N_MEMBER && isPushCall(walk.program, walk.table, call)) {
    trail.report(value, holder, "and it is stored in an array")
    return
  }
  if (sig === null) {
    return
  }
  const role = parallelRoleOf(sig)
  const index = argumentIndex(call.children[1], arg)
  if (role === PAR_FROM && index === 0) {
    trail.report(value, holder, "and it counts the elements `parallelFrom` makes")
  } else if (role === PAR_REDUCE && index === 2) {
    followFrom(trail, value, call, holder)
  } else if (role === PAR_NONE) {
    followIntoParameter(trail, call, arg, value, holder)
  }
}

/** Which of `list`'s children `arg` is. */
const argumentIndex = (list: Node, arg: Node): i32 => {
  for (let k = 0; k < list.children.length; k++) {
    if (list.children[k] === arg) {
      return k
    }
  }
  return -1
}

/** Whether a value can be followed into `sig`'s body from `walk`: a body of this module, with no instance tables to enter. */
const isFollowable = (walk: PortabilityWalk, sig: FunctionSig | null): boolean =>
  sig !== null &&
  sig.body() !== null &&
  !sig.poisoned &&
  sig.instance === null &&
  walk.sig.instance === null &&
  sig.definedIn(walk.program.source)

/**
 * The value is the argument `arg` of a call or a `new` of a function, method
 * or constructor this module defines, and it is followed through every read of
 * the parameter there. What it meets is reported at `value`, here
 * (`Relay`); what the callee answers with it is followed on from the call.
 */
const followIntoParameter = (
  trail: Trail,
  call: Node,
  arg: Node,
  value: Node,
  holder: Local | null
): void => {
  const walk = trail.walk
  const program = walk.program
  const sig =
    call.kind === N_NEW
      ? constructorOf(program, walk.table, program.nodeTypes[call.id])
      : program.nodeCallees[call.id]
  if (sig === null || !isFollowable(walk, sig) || trail.depth >= MAX_DEPTH) {
    return
  }
  const names = sig.paramNames
  const index =
    argumentIndex(call.kind === N_NEW ? call.children[2] : call.children[1], arg) +
    (names.length > 0 && names[0] === "this" ? 1 : 0)
  const body = sig.body()
  if (index < 0 || index >= names.length || body === null) {
    return
  }
  const inner = new PortabilityWalk(program, walk.table, walk.opts, walk.parents, sig, body)
  const param = parameterLocal(inner, body, names[index])
  if (param === null) {
    return
  }
  const into = new Trail(inner, trail.source, trail.kind, trail.span, trail.out)
  into.depth = trail.depth + 1
  into.relay = new Relay(trail, value, holder, call)
  followLocal(into, param)
}

/** The parameter `name` of the function `walk` is over, as a read of it under `node` binds it, or `null` if nothing reads it. */
const parameterLocal = (walk: PortabilityWalk, node: Node, name: string): Local | null => {
  if (node.kind === N_IDENT && node.text === name) {
    const local = walk.program.nodeLocals[node.id]
    if (
      local !== null &&
      local.storage === STORAGE_PARAM &&
      local.captureOf === null &&
      local.name === name
    ) {
      return local
    }
  }
  for (const child of node.children) {
    const found = parameterLocal(walk, child, name)
    if (found !== null) {
      return found
    }
  }
  return null
}

/**
 * The value is the answer of the function being walked. `main`'s is the exit
 * code; a callee reached through a parameter answers to the call it came
 * from; any other function answers to each of its callers.
 */
const followOutOfFunction = (trail: Trail, value: Node, holder: Local | null): void => {
  const relay = trail.relay
  if (isEntryMain(trail.walk)) {
    trail.report(value, holder, "and `main` returns it as the exit code")
  } else if (relay !== null) {
    followFrom(relay.trail, relay.value, relay.call, relay.holder)
  } else {
    followIntoCallers(trail, value, holder)
  }
}

/**
 * Every call in this module of the function being walked, followed from the
 * call: a direct call answers the value, unless the source counts in a
 * parameter the caller passes a provably ASCII string; a `parallelMap`,
 * `parallelMapInto` or `parallelFrom` that runs the function stores each
 * answer in its array; a `parallelReduce` that runs it folds them into its
 * own answer. An arrow handed to the form is reported where it answers, a
 * named function where it is passed.
 */
const followIntoCallers = (trail: Trail, value: Node, holder: Local | null): void => {
  const walk = trail.walk
  if (trail.depth >= MAX_DEPTH || walk.sig.instance !== null) {
    return
  }
  for (const host of walk.program.functions) {
    const body = host.body()
    if (body === null || !isFollowable(walk, host)) {
      continue
    }
    const calls: Node[] = []
    callsOf(walk, body, calls)
    if (calls.length === 0) {
      continue
    }
    const there = new PortabilityWalk(walk.program, walk.table, walk.opts, walk.parents, host, body)
    for (const call of calls) {
      followIntoCaller(trail, value, holder, there, call)
    }
  }
}

/** The calls under `node` that run the function `walk` is over, directly or as a data-parallel body; an arrow under `node` is a function of its own. */
const callsOf = (walk: PortabilityWalk, node: Node, calls: Node[]): void => {
  if (node.kind === N_ARROW) {
    return
  }
  const callee: FunctionSig | null = node.kind === N_CALL ? walk.program.nodeCallees[node.id] : null
  if (callee !== null && (callee === walk.sig || runsAsBody(callee, walk.sig))) {
    calls.push(node)
  }
  for (const child of node.children) {
    callsOf(walk, child, calls)
  }
}

/** Whether `form` is a data-parallel form whose body is `sig`. */
const runsAsBody = (form: FunctionSig, sig: FunctionSig): boolean => {
  const body = parallelBodyOf(form)
  return parallelRoleOf(form) !== PAR_NONE && body !== null && body === sig
}

/** One call `followIntoCallers` found, in `there`, the walk of the function that makes it. */
const followIntoCaller = (
  trail: Trail,
  value: Node,
  holder: Local | null,
  there: PortabilityWalk,
  call: Node
): void => {
  const args = call.children[1].children
  const callee = there.program.nodeCallees[call.id]
  const role = callee === null ? PAR_NONE : parallelRoleOf(callee)
  if (role === PAR_NONE) {
    const arg: Node | null = trail.param >= 0 && trail.param < args.length ? args[trail.param] : null
    if (arg !== null && isProvablyAscii(there, arg, [])) {
      return
    }
    const param = arg === null ? -1 : parameterIndex(there, arg)
    followValue(trail.derive(there, call, "answers", param), call, null)
    return
  }
  const at: i32 = role === PAR_MAP ? 2 : 1
  const body = args[at]
  if (role === PAR_REDUCE) {
    followValue(trail.derive(there, call.children[0], "folds in", -1), call, null)
  } else if (role !== PAR_MAP && role !== PAR_MAP_NEW && role !== PAR_FROM) {
    return
  } else if (body === trail.walk.sig.decl) {
    trail.report(value, holder, "and it is stored in an array")
  } else {
    trail.derive(there, body, "answers", -1).report(body, null, "and it is stored in an array")
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
 * `at + k`, with `k` a literal in `(0, span]`: a step past a match of a
 * provably ASCII needle that stays inside the needle (`needleSpan`).
 */
const isNeedleStep = (trail: Trail, binary: Node): boolean => {
  const other = binary.children[1]
  if (binary.text !== "+" || !isNumberLiteral(trail.walk, other)) {
    return false
  }
  const k = numberValue(trail.walk, other)
  return k > 0 && k <= trail.span
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
    if (meetsLiteral(trail.kind, literal)) {
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
    const loop = loopOf(walk, binary)
    if (
      loop !== null &&
      trail.kind === OFFSET &&
      !holdsOffset(walk, other, true) &&
      !isCursor(walk, other, loop)
    ) {
      trail.report(value, holder, `and it bounds a loop over \`${walk.textOf(other)}\``)
    }
    return false
  }
  if (op === "-" && !isLeft && trail.kind === OFFSET && !holdsOffset(walk, other, true)) {
    trail.report(value, holder, `and it is taken from \`${walk.textOf(other)}\` to pad or align the output`)
    return false
  }
  return true
}

/**
 * The `while`, `do` or `for` loop whose condition `comparison` is, through
 * parentheses, `!`, `&&` and `||`, or `null`.
 */
const loopOf = (walk: PortabilityWalk, comparison: Node): Node | null => {
  let at = comparison
  while (true) {
    const parent = walk.parents.parentOf(at)
    if (parent === null) {
      return null
    }
    const climbs =
      parent.kind === N_PAREN ||
      (parent.kind === N_UNARY && parent.text === "!") ||
      (parent.kind === N_BINARY && (parent.text === "&&" || parent.text === "||"))
    if (!climbs) {
      const isCondition =
        (parent.kind === N_WHILE && parent.children[0] === at) ||
        (parent.kind === N_DO && parent.children[1] === at) ||
        (parent.kind === N_FOR && parent.children[1] === at)
      return isCondition ? parent : null
    }
    at = parent
  }
}

/**
 * Whether `expr` is a cursor into a string inside `loop`: a local the loop
 * hands to a string's method or uses as a string's index, alone or in
 * arithmetic. A cursor bounded by a length counts in the string's own unit,
 * so the loop visits every byte here and every unit there and the work it
 * does per position agrees; a loop over anything else counts bytes as steps.
 */
const isCursor = (walk: PortabilityWalk, expr: Node, loop: Node): boolean => {
  const e = unwrapParens(expr)
  const local: Local | null = e.kind === N_IDENT ? sourceLocal(walk.program.nodeLocals[e.id]) : null
  if (local === null) {
    return false
  }
  const reads: Node[] = []
  readsOf(walk, loop, local, reads)
  for (const read of reads) {
    let at = read
    let parent = walk.parents.parentOf(at)
    while (
      parent !== null &&
      (parent.kind === N_PAREN || (parent.kind === N_BINARY && isArithmetic(parent.text)))
    ) {
      at = parent
      parent = walk.parents.parentOf(at)
    }
    if (parent === null) {
      continue
    }
    if (parent.kind === N_INDEX && parent.children[1] === at && isString(walk, parent.children[0])) {
      return true
    }
    const call: Node | null = parent.kind === N_LIST ? walk.parents.parentOf(parent) : null
    if (call !== null && call.kind === N_CALL && call.children[1] === parent) {
      const callee = unwrapParens(call.children[0])
      if (callee.kind === N_MEMBER && isString(walk, callee.children[0])) {
        return true
      }
    }
  }
  return false
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
    const arrow = enclosingArrow(trail.walk, parent)
    if (arrow !== null) {
      followOutOfArrow(trail, arrow, value, holder)
    } else {
      followOutOfFunction(trail, value, holder)
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
 * The arrow below the body being walked that `node` is inside, or `null`. A
 * value can only be followed into one through a name it captures (WP29), so
 * it is an arrow handed to a data-parallel form.
 */
const enclosingArrow = (walk: PortabilityWalk, node: Node): Node | null => {
  let at = walk.parents.parentOf(node)
  while (at !== null && at !== walk.body) {
    if (at.kind === N_ARROW) {
      return at
    }
    at = walk.parents.parentOf(at)
  }
  return null
}

/**
 * The value is the answer of `arrow`, a body a data-parallel form runs where
 * it is called. `parallelReduce` combines the answers into the call's value,
 * which is followed on from the call; every other form stores each answer in
 * the array it writes.
 */
const followOutOfArrow = (trail: Trail, arrow: Node, value: Node, holder: Local | null): void => {
  const walk = trail.walk
  const list = walk.parents.parentOf(arrow)
  const call: Node | null = list === null ? null : walk.parents.parentOf(list)
  if (call === null || call.kind !== N_CALL) {
    return
  }
  const sig = walk.program.nodeCallees[call.id]
  if (sig !== null && parallelRoleOf(sig) === PAR_REDUCE) {
    followFrom(trail, value, call, holder)
  } else {
    trail.report(value, holder, "and it is stored in an array")
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

/**
 * Whether the checker bound `node` to `local`. A name an arrow handed to a
 * data-parallel form captures (WP29) is the local itself, read where the call
 * runs the arrow, so a read of it is followed like any other.
 */
const names = (walk: PortabilityWalk, node: Node, local: Local): boolean => {
  const bound = sourceLocal(walk.program.nodeLocals[node.id])
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
