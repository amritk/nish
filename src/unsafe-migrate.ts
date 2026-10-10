// The way off `--unchecked-indexing`: every index the flag leaves unchecked is
// reported where it is, as a deprecation (NL7002), and the report carries the
// rewrite into `uncheckedGet` / `uncheckedSet` from `nish:unsafe` wherever one
// says the same thing. `nish --unchecked-indexing --fix` then states at each
// site what the flag used to decide for the whole package, and the program
// compiles without the flag to the same answers (docs/LANGUAGE.md, nish:unsafe).
//
// **The sites mirror the emitter.** A site is a check the emitter would write
// without the flag and leaves out with it: an element access the checker did
// not prove (`emitBoundsCheck`), the second check of a compound store whose
// right side calls something (`emitElementAssignment`), an unproven
// `charCodeAt` or `pop`, and every `slice`, array `set` and socket buffer
// range. They are read after `proveCallSiteRanges`, when `nodeProvenIndex` is
// final. The flag records no fact for a check it drops, so its own proofs are
// a subset of the proofs without it, and pass 2 adds the rest: it walks each
// body again recording what every access the migration leaves checked passes
// (`proveUnflagged` in src/bounds.ts), so an access the build without the flag
// proves from one of those is proven here too and never rewritten. Either
// way, an access left as `xs[i]` because it was proven stays proven once the
// flag is gone. What the whole-program pass would prove from a caller's
// passed check is not added, so such a site is still rewritten: the meaning
// is the same, and dropping the flag first is the way to keep it.
//
// **A fix is offered only where the rewrite compiles and means the same.** The
// two calls take an array of numbers and an `i32` index, `uncheckedSet` is a
// statement, and a compound store becomes a read and a write that evaluate the
// array and the index twice, so those must be plain reads. Everything else is
// reported without a fix, and dropping the flag puts its check back, which is
// the safe direction. A site in a generic body is never fixed: its types are
// decided per instantiation, and one rewrite has to hold for all of them.
//
// **The import is part of the fix.** A call needs its name imported from
// `nish:unsafe` (NL2456), so while the module lacks a name, every site's fix
// carries the one edit that adds every name the module's fixes need. The
// edits are the same, and `--fix` makes an edit it has already accepted once
// (`acceptedEdits` in src/fix.ts), so every site's fix lands in one round
// with the import. A rewritten site moves no fact its neighbours were proven
// by, either: `uncheckedGet` and `uncheckedSet` are the load and the store an
// access is to the bounds analysis (`callsNothing`). `planUnsafeImport` and
// `unsafeImportEdit` know nothing about indexing, so a migration to the
// `wrapping*` functions can reuse them for its own names.

import { hasUncheckedForm } from "./bounds"
import { CLI } from "./branding"
import { DiagnosticSink, Edit, SourceFile } from "./diagnostics"
import { arrayMethodName, builtinNameOf, isAssignmentOperator, isStringMethodCall } from "./emit-util"
import { unsafeModule } from "./nish-modules"
import {
  FLAG_OPTIONAL,
  N_BINARY,
  N_CALL,
  N_CONDITIONAL,
  N_EXPR_STMT,
  N_IDENT,
  N_IMPORT,
  N_IMPORT_SPEC,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NUMBER,
  N_PAREN,
  N_THIS,
  N_UNARY,
  Node,
} from "./nodes"
import { builtinPanicKind, PANIC_SLICE } from "./panics"
import { CheckedProgram, Instantiation } from "./program"
import { StringBuilder } from "./strings"
import { TypeTable, isNumeric } from "./types"

/** `;`, which a module that ends its statements with one gets after a new import. */
const CH_SEMICOLON: i32 = 59

/** No rewrite: the warning alone. */
const SHAPE_NONE: i32 = 0
/** `xs[i]` read: `uncheckedGet(xs, i)`. */
const SHAPE_GET: i32 = 1
/** `xs[i] = v` as a statement: `uncheckedSet(xs, i, v)`. */
const SHAPE_SET: i32 = 2
/** `xs[i] op= v` as a statement: `uncheckedSet(xs, i, uncheckedGet(xs, i) op v)`. */
const SHAPE_UPDATE: i32 = 3

/** Where the two names sit in a plan's `names`. */
const GET: i32 = 0
const SET: i32 = 1

/** The reason a site in a generic body gets no fix. */
const GENERIC_REASON: string =
  "it is in a generic body, whose element and index types are decided per instantiation, and one rewrite would have to hold for each"

/** The reason a check with no `nish:unsafe` counterpart gets no fix. */
const NO_FORM_REASON: string = "`nish:unsafe` has no unchecked form of it"

/**
 * One check the flag drops. `node` is the span reported: the access, the
 * call, or the compound store whose second check it is. A store is reported
 * at its access, so that the access and the store over it are one site;
 * `store` is the assignment, and `span` what its rewrite replaces: the
 * expression the statement holds, parentheses and all, because
 * `uncheckedSet` has to be that expression. Both are `node` otherwise.
 * `reason` says why there is no fix, and a site with one has `SHAPE_NONE`.
 */
class UncheckedSite {
  node: Node
  store: Node
  span: Node
  what: string
  reason: string
  shape: i32

  constructor(node: Node, store: Node, span: Node, what: string, shape: i32, reason: string) {
    this.node = node
    this.store = store
    this.span = span
    this.what = what
    this.shape = reason.length > 0 ? SHAPE_NONE : shape
    this.reason = reason
  }
}

/** Whether a rewrite of `shape` calls `uncheckedGet`: every one but a plain store. */
const callsGet = (shape: i32): boolean => shape === SHAPE_GET || shape === SHAPE_UPDATE

/** Whether a rewrite of `shape` calls `uncheckedSet`: every store. */
const callsSet = (shape: i32): boolean => shape === SHAPE_SET || shape === SHAPE_UPDATE

/**
 * The sites of one module, once each however many bodies reach a node. Only
 * a module the flag reaches is walked, so only its table is allocated.
 */
class ModuleSites {
  program: CheckedProgram
  sites: UncheckedSite[]
  /** Node id -> index into `sites`, or -1. */
  at: i32[]

  constructor(program: CheckedProgram) {
    this.program = program
    this.sites = []
    this.at = []
    if (program.uncheckedIndexing) {
      this.at = new Array<i32>(program.nodeTypes.length)
      let i = 0
      while (i < this.at.length) {
        this.at[i] = -1
        i = i + 1
      }
    }
  }
}

/**
 * Report every site of every entry-package module that `--unchecked-indexing`
 * leaves unchecked, each with its rewrite where it has one. A module outside
 * the entry package was compiled with every check (`ownPackage` in
 * `Compilation.load`), so it has nothing to report.
 */
export const reportUncheckedIndexSites = (
  programs: CheckedProgram[],
  table: TypeTable,
  sink: DiagnosticSink
): void => {
  const modules: ModuleSites[] = []
  for (const program of programs) {
    modules.push(new ModuleSites(program))
  }
  for (const into of modules) {
    if (into.program.uncheckedIndexing) {
      new SiteWalk(into.program, table, into, false).walk(into.program.file, null)
    }
  }
  // A generic body is checked once per instantiation, into tables of its
  // own, and the module's tables never type it, so the walk above passed it
  // over. Each instantiation is walked with its tables installed, and its
  // sites go to the module the body is written in. A generic function's
  // instantiations are listed on the module that asked for them, and a
  // generic class's members, which that list does not hold, are functions
  // whose signature carries one, as `proveCallSiteRanges` finds them.
  for (const holder of programs) {
    if (!holder.uncheckedIndexing) {
      continue
    }
    for (const info of holder.instantiationList) {
      walkInstance(holder, info, modules, table)
    }
    for (const sig of holder.functions) {
      const info = sig.instance
      if (info !== null && info.template === null) {
        walkInstance(holder, info, modules, table)
      }
    }
  }
  for (const into of modules) {
    if (into.sites.length > 0) {
      reportModule(into, sink)
    }
  }
}

/** Walk one instantiation's body with its tables, into the module that writes it. */
const walkInstance = (
  holder: CheckedProgram,
  info: Instantiation,
  modules: ModuleSites[],
  table: TypeTable
): void => {
  const body = info.sig.body()
  const origin = info.sig.origin
  if (body === null || origin === null) {
    return
  }
  for (const into of modules) {
    if (into.program.source === origin && into.program.uncheckedIndexing) {
      holder.enterInstance(info)
      new SiteWalk(holder, table, into, true).walk(body, null)
      holder.leaveInstance()
      return
    }
  }
}

/**
 * One walk over a body with one set of side tables installed on `program`.
 * A node those tables never typed belongs to a body another walk reads.
 */
class SiteWalk {
  program: CheckedProgram
  table: TypeTable
  into: ModuleSites
  generic: boolean

  constructor(program: CheckedProgram, table: TypeTable, into: ModuleSites, generic: boolean) {
    this.program = program
    this.table = table
    this.into = into
    this.generic = generic
  }

  /**
   * `statement` is the expression of the expression statement `node` is, or
   * is inside only through parentheses: the one place `uncheckedSet` may
   * stand, and the span its rewrite replaces. `null` everywhere else.
   */
  walk(node: Node, statement: Node | null): void {
    if (node.kind === N_BINARY && isAssignmentOperator(node.text) && this.isArrayIndex(node.children[0])) {
      const target = node.children[0]
      if (!this.program.nodeProvenIndex[target.id]) {
        this.noteStore(node, target, statement)
      } else if (node.text !== "=" && callsOrConstructs(node.children[1])) {
        // The first check was proven, and the emitter checks again after a
        // right side that may resize the array (CG-10); the flag drops that one.
        this.noForm(node, "the second check of this compound store")
      }
      this.walk(target.children[0], null)
      this.walk(target.children[1], null)
      this.walk(node.children[1], null)
      return
    }
    if (node.kind === N_INDEX && this.isArrayIndex(node) && !this.program.nodeProvenIndex[node.id]) {
      this.noteRead(node)
    } else if (node.kind === N_CALL) {
      this.noteCall(node)
    }
    for (const child of node.children) {
      if (node.kind === N_EXPR_STMT) {
        this.walk(child, child)
      } else {
        this.walk(child, node.kind === N_PAREN ? statement : null)
      }
    }
  }

  /** An element access on an array these tables typed. */
  isArrayIndex(node: Node): boolean {
    if (node.kind !== N_INDEX) {
      return false
    }
    const type = this.program.nodeTypes[node.children[0].id]
    return type >= 0 && this.table.isArray(type)
  }

  noteRead(node: Node): void {
    const reason = this.generic ? GENERIC_REASON : this.accessRefusal(node)
    this.record(new UncheckedSite(node, node, node, "this index", SHAPE_GET, reason))
  }

  noteStore(assign: Node, target: Node, statement: Node | null): void {
    let reason = this.generic ? GENERIC_REASON : this.accessRefusal(target)
    if (reason.length === 0) {
      reason = storeRefusal(assign, target, statement !== null)
    }
    const shape = assign.text === "=" ? SHAPE_SET : SHAPE_UPDATE
    const span = statement === null ? assign : statement
    this.record(new UncheckedSite(target, assign, span, "this index", shape, reason))
  }

  /** A check `nish:unsafe` has no form of, so its site never has a fix. */
  noForm(node: Node, what: string): void {
    this.record(
      new UncheckedSite(node, node, node, what, SHAPE_NONE, this.generic ? GENERIC_REASON : NO_FORM_REASON)
    )
  }

  /**
   * Why `xs[i]` cannot be either call, or `""`: the element must be a number
   * and the index an `i32`, which is exactly what `checkUncheckedAccess`
   * (src/builtins.ts) accepts, and `hasUncheckedForm` asks.
   */
  accessRefusal(access: Node): string {
    const program = this.program
    const table = this.table
    if (hasUncheckedForm(program, table, access)) {
      return ""
    }
    const elem = table.refOf(program.nodeTypes[access.children[0].id])
    if (!isNumeric(elem)) {
      return `\`${unsafeModule()}\` reads and writes only arrays of numbers, and this one holds ${table.typeName(elem)}`
    }
    const index = program.nodeTypes[access.children[1].id]
    return `\`uncheckedGet\` and \`uncheckedSet\` take an i32 index, and this one is ${table.typeName(index)}`
  }

  /** The method and builtin calls whose check the flag drops: none of them has a `nish:unsafe` form. */
  noteCall(call: Node): void {
    const program = this.program
    const proven = program.nodeProvenIndex[call.id]
    if (isStringMethodCall(program, call)) {
      const name = call.children[0].text
      if ((name === "charCodeAt" && !proven) || name === "slice") {
        this.noForm(call, `this \`${name}\``)
      }
      return
    }
    const method = arrayMethodName(program, this.table, call)
    if ((method === "pop" && !proven) || method === "set") {
      this.noForm(call, `this \`${method}\``)
      return
    }
    // A socket call checks its buffer range: the builtin sites the attribute
    // pass records as `slice` panics (`noteBuiltinSite`).
    const callee = call.children[0]
    if (
      callee.kind === N_IDENT &&
      program.nodeCallees[call.id] === null &&
      builtinPanicKind(builtinNameOf(program, call)) === PANIC_SLICE
    ) {
      this.noForm(call, `this \`${callee.text}\``)
    }
  }

  /** Keep a site once. A node an instantiation reaches is in a generic body, so it loses its fix. */
  record(site: UncheckedSite): void {
    const into = this.into
    const id = site.node.id
    if (id < 0 || id >= into.at.length) {
      return
    }
    const at = into.at[id]
    if (at < 0) {
      into.at[id] = into.sites.length
      into.sites.push(site)
    } else if (this.generic && at < into.sites.length) {
      const kept = into.sites[at]
      kept.shape = SHAPE_NONE
      kept.reason = GENERIC_REASON
    }
  }
}

/**
 * Why a store to `target` has no rewrite into `uncheckedSet`, or `""`. The
 * value needs no test of its own: a store to an array of numbers compiles
 * only with a value of exactly the element type, which is what
 * `uncheckedSet` takes, and a compound store's operator is one of the binary
 * operators, the only ones the checker accepts in front of `=`.
 */
const storeRefusal = (assign: Node, target: Node, statement: boolean): string => {
  if (!statement) {
    return "`uncheckedSet` is a statement, and the value of this store is used"
  }
  // The rewrite evaluates the array and the index twice, and the right side
  // after the read rather than before the store's second check, so each has
  // to be a plain read for the two to compute the same thing.
  if (
    assign.text !== "=" &&
    !(isPlainRead(target.children[0]) && isPlainRead(target.children[1]) && isPlainRead(assign.children[1]))
  ) {
    return "a compound store becomes a read and a write that evaluate the array and the index twice, and here the array, the index or the right side calls, constructs or assigns"
  }
  return ""
}

/**
 * An expression that computes the same value however often it is evaluated
 * and changes nothing: names, literals, field and element reads and the
 * operators over them. A read may still panic (a checked element, a division),
 * but evaluated twice it panics the first time or not at all.
 */
const isPlainRead = (node: Node): boolean => {
  const kind = node.kind
  if (kind === N_IDENT || kind === N_NUMBER || kind === N_THIS) {
    return true
  }
  if (kind === N_BINARY && isAssignmentOperator(node.text)) {
    return false
  }
  if (kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    return false
  }
  if ((kind === N_MEMBER || kind === N_INDEX) && (node.flags & FLAG_OPTIONAL) !== 0) {
    return false
  }
  if (
    kind !== N_PAREN &&
    kind !== N_MEMBER &&
    kind !== N_INDEX &&
    kind !== N_BINARY &&
    kind !== N_UNARY &&
    kind !== N_CONDITIONAL
  ) {
    return false
  }
  for (const child of node.children) {
    if (!isPlainRead(child)) {
      return false
    }
  }
  return true
}

/**
 * Whether evaluating `node` can run a call or a constructor: the test
 * `FactCollector.collectArrayFacts` (src/attributes.ts) puts in front of the
 * second check of a compound store, so a site here is one the emitter may write.
 */
const callsOrConstructs = (node: Node): boolean => {
  if (node.kind === N_CALL || node.kind === N_NEW) {
    return true
  }
  for (const child of node.children) {
    if (callsOrConstructs(child)) {
      return true
    }
  }
  return false
}

/** Report one module's sites, each with its rewrite and, while a name is missing, the import. */
const reportModule = (into: ModuleSites, sink: DiagnosticSink): void => {
  const program = into.program
  const plan = planUnsafeImport(program, ["uncheckedGet", "uncheckedSet"])
  const get = plan.names[GET]
  const set = plan.names[SET]
  // A site whose name the module cannot bind loses its fix, so the import
  // names only what the remaining fixes call.
  for (const site of into.sites) {
    let refusal = ""
    if (callsGet(site.shape) && get.refusal.length > 0) {
      refusal = get.refusal
    } else if (callsSet(site.shape) && set.refusal.length > 0) {
      refusal = set.refusal
    }
    if (refusal.length > 0) {
      site.shape = SHAPE_NONE
      site.reason = refusal
    }
    get.needed = get.needed || callsGet(site.shape)
    set.needed = set.needed || callsSet(site.shape)
  }
  const importEdit = unsafeImportEdit(plan)
  const unsafe = unsafeModule()
  for (const site of into.sites) {
    const edits: Edit[] = []
    let text = ""
    if (site.shape === SHAPE_NONE) {
      text = `${site.what} is unchecked only because of --unchecked-indexing, which is deprecated: ${site.reason}, so dropping the flag puts its check back`
    } else {
      text = `${site.what} is unchecked only because of --unchecked-indexing, which is deprecated: write it as ${spelledRewrite(site.shape)} from \`${unsafe}\` to keep it unchecked once the flag is gone (\`${CLI} --fix\` does), or leave it to be checked`
      if (importEdit !== null) {
        edits.push(importEdit)
      }
      edits.push(siteEdit(program.source, get.local, set.local, site))
    }
    sink.reportDeprecationFix(program.source, site.node.start, site.node.end, text, edits)
  }
}

/** The rewrite as the message spells it, in the letters `runtime/nish.d.ts` uses. */
const spelledRewrite = (shape: i32): string => {
  if (shape === SHAPE_GET) {
    return "`uncheckedGet(xs, i)`"
  }
  return shape === SHAPE_SET ? "`uncheckedSet(xs, i, v)`" : "`uncheckedSet(xs, i, uncheckedGet(xs, i) op v)`"
}

/** The edit that rewrites one site into the calls, by the names the module binds them to. */
const siteEdit = (source: SourceFile, get: string, set: string, site: UncheckedSite): Edit => {
  if (site.shape === SHAPE_GET) {
    const access = site.node
    return new Edit(
      access.start,
      access.end,
      `${get}(${textOf(source, access.children[0])}, ${textOf(source, access.children[1])})`
    )
  }
  // A store is reported at its target and rewritten whole: the statement's
  // expression, parentheses included, becomes the call.
  const target = site.node
  const assign = site.store
  const span = site.span
  const xs = textOf(source, target.children[0])
  const i = textOf(source, target.children[1])
  if (site.shape === SHAPE_SET) {
    return new Edit(span.start, span.end, `${set}(${xs}, ${i}, ${textOf(source, assign.children[1])})`)
  }
  const value = assign.children[1]
  const op = assign.text.substring(0, assign.text.length - 1)
  const right = isAtom(value) ? textOf(source, value) : `(${textOf(source, value)})`
  return new Edit(span.start, span.end, `${set}(${xs}, ${i}, ${get}(${xs}, ${i}) ${op} ${right})`)
}

/** An operand that needs no parentheses after a binary operator. */
const isAtom = (node: Node): boolean =>
  node.kind === N_IDENT ||
  node.kind === N_NUMBER ||
  node.kind === N_PAREN ||
  node.kind === N_MEMBER ||
  node.kind === N_INDEX ||
  node.kind === N_CALL ||
  node.kind === N_THIS

const textOf = (source: SourceFile, node: Node): string => source.text.substring(node.start, node.end)

/**
 * One of `nish:unsafe`'s functions as a module calls it: by `local`, the alias
 * of an import that already binds it (`bound`) or the name itself; `refusal`
 * says why the module cannot bind it, and `needed` whether a fix calls it.
 */
class UnsafeName {
  name: string
  local: string
  refusal: string
  bound: boolean
  needed: boolean

  constructor(name: string) {
    this.name = name
    this.local = name
    this.refusal = ""
    this.bound = false
    this.needed = false
  }
}

/**
 * What a module needs to call some of `nish:unsafe`'s functions. `list` is
 * the braces of its last `nish:unsafe` import, which an edit extends; `after`
 * its last import of any module, after which a new one goes; `first` its
 * first statement, before which a new one goes when there is no other.
 */
class UnsafeImport {
  names: UnsafeName[]
  list: Node | null
  after: Node | null
  first: Node | null
  semicolon: boolean

  constructor() {
    this.names = []
    this.list = null
    this.after = null
    this.first = null
    this.semicolon = false
  }
}

/**
 * Read a module's imports for `names`, from the bindings the checker kept
 * (`CheckedProgram.unsafeImports`): a name an import binds is called by its
 * local name, so `uncheckedGet as get` is kept. A name none binds is refused
 * when the module already uses that identifier for anything, because the new
 * binding would collide with it.
 */
const planUnsafeImport = (program: CheckedProgram, names: string[]): UnsafeImport => {
  const plan = new UnsafeImport()
  for (const name of names) {
    plan.names.push(new UnsafeName(name))
  }
  let last: Node | null = null
  for (const imp of program.unsafeImports) {
    if (last === null || imp.decl.start > last.start) {
      last = imp.decl
    }
    for (const entry of plan.names) {
      if (imp.importedName === entry.name) {
        entry.local = imp.localName
        entry.bound = true
      }
    }
  }
  plan.list = last === null ? null : last.children[0]
  const file = program.file
  const text = program.source.text
  for (const stmt of file.children) {
    if (plan.first === null) {
      plan.first = stmt
    }
    plan.semicolon = plan.semicolon || (stmt.end > 0 && text.charCodeAt(stmt.end - 1) === CH_SEMICOLON)
    if (stmt.kind === N_IMPORT) {
      plan.after = stmt
    }
  }
  const unsafe = unsafeModule()
  for (const entry of plan.names) {
    if (!entry.bound && usesName(file, entry.name, unsafe)) {
      entry.refusal = `the module already uses the name \`${entry.name}\`, which the \`${unsafe}\` import would bind`
    }
  }
  return plan
}

/** Whether `name` is an identifier or an imported binding anywhere in the module, outside a `nish:unsafe` import. */
const usesName = (node: Node, name: string, unsafe: string): boolean => {
  if (node.kind === N_IMPORT && node.text === unsafe) {
    return false
  }
  if ((node.kind === N_IDENT || node.kind === N_IMPORT_SPEC) && node.text === name) {
    return true
  }
  for (const child of node.children) {
    if (usesName(child, name, unsafe)) {
      return true
    }
  }
  return false
}

/**
 * The one edit that binds every name a fix needs and the module does not
 * bind yet, or `null` when there is none to bind: the names after the last
 * one of the module's `nish:unsafe` import, or a new import after its last
 * import, or before its first statement, written with a semicolon when the
 * module ends its statements with one. Every site's fix carries this same
 * edit, which is what makes `--fix` apply it once.
 */
const unsafeImportEdit = (plan: UnsafeImport): Edit | null => {
  const missing = new StringBuilder()
  for (const entry of plan.names) {
    if (entry.needed && !entry.bound) {
      missing.add(missing.isEmpty() ? entry.name : `, ${entry.name}`)
    }
  }
  if (missing.isEmpty()) {
    return null
  }
  const names = missing.toText()
  const list = plan.list
  if (list !== null && list.children.length > 0) {
    const last = list.children[list.children.length - 1]
    return new Edit(last.end, last.end, `, ${names}`)
  }
  const statement = `import { ${names} } from "${unsafeModule()}"${plan.semicolon ? ";" : ""}`
  const after = plan.after
  if (after !== null) {
    return new Edit(after.end, after.end, `\n${statement}`)
  }
  const first = plan.first
  const at = first === null ? 0 : first.start
  return new Edit(at, at, `${statement}\n\n`)
}
