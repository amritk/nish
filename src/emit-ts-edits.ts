// The composer behind `--emit-ts` (wp33 §3): it writes one checked module back
// out as TypeScript by walking its tree and asking four row hooks, in a fixed
// order, whether a node needs other text under Node than it has in the source.
//
// Nothing is printed from the tree. A node no hook rewrites is written as the
// bytes of its own source span, with each child that did change spliced in, so
// a module in which nothing changed comes back byte for byte, comments and
// layout included. That is the property the `emit-ts` identity fixtures pin,
// and it is why the composer records *edits* against the source rather than a
// new text: a top-level statement that comes back unchanged contributes none.
//
// The four hooks live in `src/emit-ts-{numbers,strings,records,control}.ts`.
// Each one is a function of the shape `(walk, node, operands) => string | null`
// and answers `null` for a node it has nothing to say about. A row stage fills
// its own file and touches nothing else here: the call order below is the
// whole of the dispatch, so adding a rewrite never means editing the composer.
//
// A generic body is walked once per instance with that instance's tables
// installed (`CheckedProgram.enterInstance`), because a hook reads the type of
// a node and the types differ per instance. TypeScript has one copy of the
// body, so two instances that would write it differently cannot both be
// right; that is reported as an internal error naming the node, not guessed.

import { Edit, SourceFile } from "./diagnostics"
import { controlRow } from "./emit-ts-control"
import { numbersRow } from "./emit-ts-numbers"
import { recordsRow } from "./emit-ts-records"
import { stringsRow } from "./emit-ts-strings"
import { StringSet } from "./map"
import { isNetExport } from "./nish-modules"
import {
  FLAG_FOREIGN,
  FLAG_TYPE_ONLY,
  N_CALL,
  N_FUNCTION,
  N_IDENT,
  N_IMPORT,
  N_IMPORT_SPEC,
  N_LIST,
  N_TYPE_REF,
  Node,
} from "./nodes"
import { CheckedProgram, Instantiation, STRUCT_INTERFACE } from "./program"
import { StringBuilder } from "./strings"

/**
 * The names a module may use without importing them, because Nish declares
 * them ambiently, that `nish/runtime` exports under the same name. A call to
 * one of these is what makes the composer add an import line: Node has no
 * ambient `write` or `toI32`, so the emitted module has to ask for it.
 *
 * `signalFd` and `readSignal` are absent on purpose: they are refused
 * (NL4011), not imported.
 */
const AMBIENT_NAMES: string =
  " write writeError panic readFileSync readFileSyncOrNull" +
  " readFileBytesSync writeFileSync appendFileSync mkdirSync" +
  " isDirectorySync readdirSync realpathSync getenv spawnSync spawnSyncTo" +
  " spawn kill waitPid availableParallelism totalMemory monotonicNanos" +
  " statMtimeSync lstatOwnerModeSync geteuid isExecutableSync toI32 toI64" +
  " toF64 f64ToBits f32ToBits bitsToF64 ctSelect ctEq parseInt parseFloat secureZero" +
  " Ok Err arena readStdin waitStdin isTerminal terminalSize setRawMode "

/**
 * The width types `nish/runtime` declares (`runtime/core.d.ts`). Node's type
 * stripping erases them, so the `import type` line the driver writes for them
 * is only there for a reader running `tsc` over the output.
 */
const WIDTH_TYPES: string = " i32 i64 u8 u16 u32 u64 f32 f64 "

/** The message NL4011 carries; `src/codes.ts` keys the code on it. */
export const SIGNAL_REFUSAL: string =
  "--emit-ts cannot yet write signalFd, readSignal or nish:net, whose translation is not local to its statement (wp33 §3.5)"

/** The message NL4010 carries; `src/codes.ts` keys the code on it. */
const FOREIGN_REFUSAL: string =
  "--emit-ts cannot write a module that declares C functions; keep it native and import it through --emit-napi (wp33 §4.4)"

/**
 * One module's walk: the tables the hooks read, and what the walk learns on
 * the way that the driver needs once it is over (the helpers to import, the
 * width types spelled, the refusals). A hook receives it as its first argument
 * and may call `useHelper`; everything else on it is the composer's.
 */
export class Walk {
  program: CheckedProgram
  source: SourceFile
  /**
   * Per node id, the first entry of `instances` whose function was declared by
   * that node, or -1; `instanceNext` chains the rest. Two arrays rather than a
   * list per node because the tables are per id everywhere else too.
   */
  instanceHead: i32[]
  instanceNext: i32[]
  instances: Instantiation[]
  /** An instance's tables are installed, so a template node is walked as itself. */
  inInstance: boolean
  /** The second or a later instance of one template is being walked: its refusals were already recorded. */
  repeat: boolean
  /** Every name the emitted module must import from `nish/runtime`, in first-use order. */
  helpers: StringSet
  /** Every width type the module spells, in first-use order. */
  widths: StringSet
  /**
   * The local names this module imports that name only a type: an interface
   * or a type alias. Node's type stripping erases an `import` element only
   * when it says `type`, so each is written with one.
   */
  typeNames: StringSet
  /** The import specifiers the driver rewrites, and what each becomes. */
  specifierFrom: string[]
  specifierTo: string[]
  /** The nodes the module is refused at, with the message for each. */
  refusedAt: Node[]
  refusals: string[]
  /** An internal error the walk ran into, or the empty string. */
  failure: string

  constructor(program: CheckedProgram, source: SourceFile, nodeCount: i32) {
    this.program = program
    this.source = source
    this.instanceHead = []
    let i = 0
    while (i < nodeCount) {
      this.instanceHead.push(-1)
      i = i + 1
    }
    this.instanceNext = []
    this.instances = []
    this.inInstance = false
    this.repeat = false
    this.helpers = new StringSet()
    this.widths = new StringSet()
    this.typeNames = new StringSet()
    for (const imp of program.imports) {
      const struct = imp.struct
      const template = imp.structTemplate
      if (
        (struct !== null && struct.kind === STRUCT_INTERFACE) ||
        (template !== null && template.kind === STRUCT_INTERFACE)
      ) {
        this.typeNames.add(imp.localName)
      }
    }
    // An imported enum is a value, and is bound here too; an alias is not.
    for (const imp of program.typeImports) {
      if (program.aliases.get(imp.localName, -1) >= 0) {
        this.typeNames.add(imp.localName)
      }
    }
    this.specifierFrom = []
    this.specifierTo = []
    this.refusedAt = []
    this.refusals = []
    this.failure = ""
    // Only the instances whose body is in this module: an imported generic is
    // walked by the module that declares it.
    for (const sig of program.functions) {
      const instance = sig.instance
      if (instance !== null && sig.definedIn(source) && sig.decl.id >= 0 && sig.decl.id < nodeCount) {
        this.instanceNext.push(this.instanceHead[sig.decl.id])
        this.instanceHead[sig.decl.id] = this.instances.length
        this.instances.push(instance)
      }
    }
  }

  /**
   * Ask for a `nish/runtime` export by name, for a row hook whose rewrite calls
   * it. The driver puts every name asked for on the module's import line, once.
   */
  useHelper(name: string): void {
    this.helpers.add(name)
  }

  /** Refuse the module at `node`, once even when a generic body is walked per instance. */
  refuse(node: Node, message: string): void {
    if (!this.repeat) {
      this.refusedAt.push(node)
      this.refusals.push(message)
    }
  }

  /** Record the first internal error; the driver turns it into the compiler's internal-error exit. */
  fail(message: string): void {
    if (this.failure.length === 0) {
      this.failure = message
    }
  }

  /** The source bytes of `node`'s span. */
  spanOf(node: Node): string {
    return this.source.text.substring(node.start, node.end)
  }
}

/**
 * What a node's children came to, handed to every row hook. A child that did
 * not change is not copied out of the source until a hook asks for it with
 * `at`, because nearly every node of nearly every module is unchanged and a
 * copy per node would cost the depth of the tree in bytes.
 */
export class Operands {
  node: Node
  source: string
  /** Per child, its emitted text when `changed` says it differs from the source, else the empty string. */
  texts: string[]
  changed: boolean[]
  /** Whether any child changed. */
  any: boolean

  constructor(node: Node, source: string) {
    this.node = node
    this.source = source
    this.texts = []
    this.changed = []
    this.any = false
  }

  /** Child `i` as the emitted module will spell it. */
  at(i: i32): string {
    if (this.changed[i]) {
      return this.texts[i]
    }
    const child = this.node.children[i]
    return this.source.substring(child.start, child.end)
  }
}

/** Whether `name` is one of the space-separated words of `names`. */
const listedWord = (names: string, name: string): boolean => names.indexOf(` ${name} `) >= 0

/**
 * What one node tells the driver whatever it is rewritten to: an ambient
 * builtin call needs an import, a width type an `import type`, and two
 * builtins are refused. An ambient call is a plain identifier call that the
 * checker bound to no function of the program and to no `nish:` import.
 */
const observe = (walk: Walk, node: Node): void => {
  if (node.kind === N_TYPE_REF && listedWord(WIDTH_TYPES, node.text)) {
    walk.widths.add(node.text)
    return
  }
  if (node.kind !== N_CALL || node.children.length === 0 || node.children[0].kind !== N_IDENT) {
    return
  }
  const program = walk.program
  if (program.nodeCallees[node.id] !== null) {
    return
  }
  const imported = program.nodeBuiltins[node.id]
  const name = imported.length > 0 ? imported : node.children[0].text
  // Every `nish:net` name is a global builtin too, so a call spelled without
  // the import is refused here, by the same table the checker binds it by.
  if (name === "signalFd" || name === "readSignal" || isNetExport(name)) {
    walk.refuse(node, SIGNAL_REFUSAL)
    return
  }
  if (imported.length === 0 && listedWord(AMBIENT_NAMES, name)) {
    walk.helpers.add(name)
  }
}

/** Whether two answers of `changedText` agree: both unchanged, or the same text. */
const sameAnswer = (aChanged: boolean, a: string, bChanged: boolean, b: string): boolean =>
  aChanged === bChanged && (!aChanged || a === b)

/**
 * The text `node` is written as, and whether it differs from the source. The
 * text is left empty when it does not differ, so an unchanged subtree costs no
 * copy. The answer goes into `out`, which keeps the recursion free of a
 * nullable string per node.
 */
const changedText = (walk: Walk, node: Node, out: Operands, slot: i32): void => {
  if (
    !walk.inInstance &&
    node.id >= 0 &&
    node.id < walk.instanceHead.length &&
    walk.instanceHead[node.id] >= 0
  ) {
    changedAcrossInstances(walk, node, out, slot)
    return
  }
  observe(walk, node)
  const operands = new Operands(node, walk.source.text)
  let i = 0
  while (i < node.children.length) {
    operands.texts.push("")
    operands.changed.push(false)
    changedText(walk, node.children[i], operands, i)
    if (operands.changed[i]) {
      operands.any = true
    }
    i = i + 1
  }
  // The fixed order. A later row sees a node only when every earlier row left
  // it alone, so two rows never both rewrite one node.
  let rewritten = numbersRow(walk, node, operands)
  if (rewritten === null) {
    rewritten = stringsRow(walk, node, operands)
  }
  if (rewritten === null) {
    rewritten = recordsRow(walk, node, operands)
  }
  if (rewritten === null) {
    rewritten = controlRow(walk, node, operands)
  }
  if (rewritten !== null) {
    if (rewritten !== walk.spanOf(node)) {
      out.texts[slot] = rewritten
      out.changed[slot] = true
    }
    return
  }
  if (operands.any) {
    out.texts[slot] = splice(walk, node, operands)
    out.changed[slot] = true
  }
}

/**
 * A template node, walked once per instance. The first instance's answer is
 * the one written; every later one has to agree with it.
 */
const changedAcrossInstances = (walk: Walk, node: Node, out: Operands, slot: i32): void => {
  const program = walk.program
  let k = walk.instanceHead[node.id]
  let first = true
  let firstChanged = false
  let firstText = ""
  while (k >= 0) {
    program.enterInstance(walk.instances[k])
    walk.inInstance = true
    walk.repeat = !first
    out.texts[slot] = ""
    out.changed[slot] = false
    changedText(walk, node, out, slot)
    walk.inInstance = false
    walk.repeat = false
    program.leaveInstance()
    if (first) {
      firstChanged = out.changed[slot]
      firstText = out.texts[slot]
      first = false
    } else if (!sameAnswer(firstChanged, firstText, out.changed[slot], out.texts[slot])) {
      const at = node.start
      walk.fail(
        `--emit-ts: two instances of the generic at ${walk.source.path}:${walk.source.lineOf(at)}:${walk.source.columnOf(at)} would be written as different TypeScript`
      )
    }
    k = walk.instanceNext[k]
  }
  out.texts[slot] = firstText
  out.changed[slot] = firstChanged
}

/**
 * `node`'s source span with each changed child replaced by its text. Children
 * are spliced front to back; one that does not lie inside its parent, after
 * the previous one, cannot be placed, and that is an internal error rather
 * than a guess at where it goes.
 */
const splice = (walk: Walk, node: Node, operands: Operands): string => {
  const text = walk.source.text
  const sb = new StringBuilder()
  let cursor = node.start
  let i = 0
  while (i < node.children.length) {
    if (operands.changed[i]) {
      const child = node.children[i]
      if (child.start < cursor || child.end > node.end) {
        walk.fail(
          `--emit-ts: a rewritten node at ${walk.source.path}:${walk.source.lineOf(child.start)}:${walk.source.columnOf(child.start)} does not lie inside its parent`
        )
        return walk.spanOf(node)
      }
      sb.add(text.slice(cursor, child.start))
      sb.add(operands.texts[i])
      cursor = child.end
    }
    i = i + 1
  }
  sb.add(text.substring(cursor, node.end))
  return sb.toText()
}

/**
 * The specifier literal of `node`, an import, as a byte span of the source:
 * the parser keeps the decoded text and not where the literal was, so it is
 * found again as the last quoted copy of that text inside the statement.
 * Answers the start, or -1.
 */
const specifierStart = (walk: Walk, node: Node): i32 => {
  const span = walk.spanOf(node)
  let at = lastOf(span, `"${node.text}"`)
  if (at < 0) {
    at = lastOf(span, `'${node.text}'`)
  }
  return at < 0 ? -1 : node.start + at + 1
}

/** Where the last copy of `needle` starts in `text`, or -1. */
const lastOf = (text: string, needle: string): i32 => {
  let found = -1
  let at = text.indexOf(needle, 0)
  while (at >= 0) {
    found = at
    at = text.indexOf(needle, at + 1)
  }
  return found
}

/**
 * Walk the module's top-level statements and collect their edits, front to
 * back: `type` before an imported name that is only a type (`typeNames`), a
 * rewritten import specifier (from `specifierFrom`), and each statement that
 * comes back with other text. The refusals that need no walk,
 * a `declare function`, are recorded here too.
 */
export const emitModule = (walk: Walk, file: Node, edits: Edit[]): void => {
  for (const stmt of file.children) {
    if (stmt.kind === N_IMPORT) {
      if (
        stmt.children.length > 0 &&
        stmt.children[0].kind === N_LIST &&
        (stmt.flags & FLAG_TYPE_ONLY) === 0
      ) {
        for (const spec of stmt.children[0].children) {
          if (
            spec.kind === N_IMPORT_SPEC &&
            (spec.flags & FLAG_TYPE_ONLY) === 0 &&
            walk.typeNames.has(spec.text)
          ) {
            edits.push(new Edit(spec.start, spec.start, "type "))
          }
        }
      }
      let k = 0
      while (k < walk.specifierFrom.length) {
        if (walk.specifierFrom[k] === stmt.text) {
          const start = specifierStart(walk, stmt)
          if (start < 0) {
            walk.fail(
              `--emit-ts: the specifier of the import at ${walk.source.path}:${walk.source.lineOf(stmt.start)}:${walk.source.columnOf(stmt.start)} is not spelled as one literal`
            )
            return
          }
          edits.push(new Edit(start, start + stmt.text.length, walk.specifierTo[k]))
        }
        k = k + 1
      }
      continue
    }
    if (stmt.kind === N_FUNCTION && (stmt.flags & FLAG_FOREIGN) !== 0) {
      walk.refuse(stmt, FOREIGN_REFUSAL)
      continue
    }
    const holder = new Operands(stmt, walk.source.text)
    holder.texts.push("")
    holder.changed.push(false)
    changedText(walk, stmt, holder, 0)
    if (holder.changed[0]) {
      edits.push(new Edit(stmt.start, stmt.end, holder.texts[0]))
    }
  }
}

/**
 * `text` with `edits` applied. They arrive in source order and do not
 * overlap, which the composer guarantees by construction; one that breaks
 * that is an internal error, reported through `walk`.
 */
export const applyModuleEdits = (walk: Walk, text: string, edits: Edit[]): string => {
  const sb = new StringBuilder()
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) {
      walk.fail(`--emit-ts: two edits to ${walk.source.path} overlap at byte ${edit.start}`)
      return text
    }
    sb.add(text.slice(cursor, edit.start))
    sb.add(edit.text)
    cursor = edit.end
  }
  sb.add(text.substring(cursor, text.length))
  return sb.toText()
}
