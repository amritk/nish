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
//
// A hook may also put statements before the statement its node is part of, for
// a rewrite that JavaScript cannot spell as an expression (`x.orReturn()`, which
// returns from the function). It asks `walk.canHoist()` first and, when that
// answers true, calls `walk.hoist(text)` once per statement, in the order they
// run; `walk.temporary()` names a local for it. The composer writes them ahead
// of the enclosing statement, each on its own line at that statement's
// indentation. It answers true only where moving the node's evaluation to the
// start of its statement keeps the program's meaning:
//
// - the node is evaluated exactly once whenever its statement runs, so it is
//   not the right of `&&`, `||` or `??`, a branch of `?:`, a loop's condition
//   or update, an `if` or loop body that is not a block, a `case` label, a
//   field initializer, a concise arrow body, a link of an optional chain past
//   its first `?.` or an argument of one, or a module-level statement
//   (`hoistChild` lists the positions that are; a block's statements start
//   afresh, so a nested function's block body hoists into itself); and
// - nothing ran in the statement before it that the move would reorder it
//   against, except what an earlier hoist already moved: an effect (a call, a
//   `new`, an assignment, `++`, `--`, or a declarator with an initializer,
//   which binds a name a later declarator may read), an operation that may
//   panic (an integer `/` or `%`, or checked arithmetic, neither proven), or
//   a read of a field or an element, which the node may change.
//   `this.pos + this.read().orReturn()` reads `this.pos` first, and
//   `a / b + f().orReturn()` may stop at the division first, so neither is
//   hoisted. A read of a local blocks the hoist only when the node itself
//   writes something (`n + g(n++).orReturn()`): an arrow captures nothing, so
//   no call can reach a local, and an assignment to it before the node is an
//   effect already.
//
// A hook that cannot hoist writes the node some other way; the control row
// has one for every node it hoists.

import { checksOverflow } from "./bounds"
import { isBuiltinFunction } from "./builtins"
import { Edit, SourceFile } from "./diagnostics"
import { controlRow } from "./emit-ts-control"
import { numbersRow } from "./emit-ts-numbers"
import { recordsRow } from "./emit-ts-records"
import { stringsRow } from "./emit-ts-strings"
import { StringSet } from "./map"
import { isBuiltinSpecifier, isNetExport, nishExport } from "./nish-modules"
import {
  FLAG_FOREIGN,
  FLAG_OPTIONAL,
  FLAG_TYPE_ONLY,
  N_ARRAY,
  N_ARROW,
  N_AS,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_CLASS,
  N_CONSTRUCTOR,
  N_EMPTY,
  N_EXPR_STMT,
  N_FIELD,
  N_FOR,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IF,
  N_IMPORT,
  N_IMPORT_SPEC,
  N_INDEX,
  N_LIST,
  N_MEMBER,
  N_METHOD,
  N_MODULE_CONST,
  N_NEW,
  N_OBJECT,
  N_PAREN,
  N_PROPERTY,
  N_RETURN,
  N_SPREAD,
  N_SWITCH,
  N_TEMPLATE,
  N_THROW,
  N_TYPE_REF,
  N_UNARY,
  N_VAR,
  N_VAR_DECL,
  Node,
} from "./nodes"
import { CheckedProgram, Instantiation, STRUCT_INTERFACE } from "./program"
import { StringBuilder } from "./strings"
import { isInteger, TypeTable } from "./types"

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
  " spawn kill waitPid availableParallelism totalMemory setNice setIdlePriority" +
  " monotonicNanos wallClockNanos statMtimeSync lstatOwnerModeSync geteuid isExecutableSync toI32 toI64" +
  " toF64 f64ToBits f32ToBits bitsToF64 ctSelect ctEq parseInt parseFloat secureZero" +
  " Ok Err arena readStdin waitStdin isTerminal terminalSize setRawMode" +
  " setTerminalRestore renameSync unlinkSync writeFileBytesSync writeBytes spawnPiped "

/**
 * The width types `nish/runtime` declares (`runtime/core.d.ts`), and the
 * typed-array aliases, which it declares as the arrays they are in Nish
 * (`Int32Array` is `i32[]`). Node's type stripping erases them, so the `import type` line the driver writes for them
 * is only there for a reader running `tsc` over the output.
 */
const WIDTH_TYPES: string =
  " i32 i64 u8 u16 u32 u64 f32 f64 integer Int32Array Float32Array Float64Array BigInt64Array "

/** The message NL4011 carries; `src/codes.ts` keys the code on it. */
export const SIGNAL_REFUSAL: string =
  "--emit-ts cannot yet write signalFd, readSignal or nish:net, whose translation is not local to its statement (wp33 §3.5)"

/** The message NL4013 carries; `src/codes.ts` keys the code on it. */
const INSTANCES_REFUSAL: string =
  "--emit-ts cannot write this generic, whose instances would be written as different TypeScript: an element held inline in one and by reference in another, or two element types with different zeros; write a function per element type"

/** The message NL4014 carries; `src/codes.ts` keys the code on it. */
const UNTYPED_REFUSAL: string =
  "--emit-ts cannot write this generic, which no instance reaches: its body copies or zero-fills an element whose type only an instance would say; call it with the element type it is for, or write a function per element type"

/** The message NL4010 carries; `src/codes.ts` keys the code on it. */
const FOREIGN_REFUSAL: string =
  "--emit-ts cannot write a module that declares C functions; keep it native and import it through --emit-napi (wp33 §4.4)"

/**
 * One module's walk: the tables the hooks read, and what the walk learns on
 * the way that the driver needs once it is over (the helpers to import, the
 * width types spelled, the refusals). A hook receives it as its first argument
 * and may call `helperName`; everything else on it is the composer's.
 */
export class Walk {
  program: CheckedProgram
  source: SourceFile
  /** The compilation's types, which `mayPanic` reads a node's base type in. */
  table: TypeTable
  /**
   * Per node id, the first entry of `instances` whose function was declared by
   * that node, or -1; `instanceNext` chains the rest. Two arrays rather than a
   * list per node because the tables are per id everywhere else too.
   */
  instanceHead: i32[]
  instanceNext: i32[]
  instances: Instantiation[]
  /**
   * Per node id, whether the node is a generic function or method, or the
   * constructor of a generic class, that no instance reaches: the native build
   * compiles no body for it, and the checker typed none, so it is walked
   * `untyped`, and written with a throwing body where its text would need those
   * types (`needsTypes`, or a row that asked for one: `typeMiss`).
   */
  stubbed: boolean[]
  /**
   * A body no instance reaches is being walked. Its nodes have no types, so
   * the rows that need none rewrite it as they would any code and the rest
   * leave it as written; a copy or a zero that an element type would decide
   * is refused (NL4014) in the program's own modules, since no instance says
   * which, and written as a stub in the standard library's.
   */
  untyped: boolean
  /** An instance's tables are installed, so a template node is walked as itself. */
  inInstance: boolean
  /** The second or a later instance of one template is being walked: its refusals were already recorded. */
  repeat: boolean
  /**
   * The records row chose a copy or a zero from the instance's types while
   * this instance was walked, so instances that disagree are refused (NL4013)
   * rather than reported as an internal error.
   */
  instanceChoice: boolean
  /**
   * Whether a stub written with a throwing body is warned about, and a copy
   * or zero an untyped body would choose is refused: the driver's answer, true
   * for the program's own modules and false for the standard library's, whose
   * bodies (`insertAt`, `Channel.send` and the like) are not the reader's to
   * change and are written as stubs without a word.
   */
  warnStubs: boolean
  /**
   * A row asked for the type of a node in the untyped body being walked and
   * found none, where a type would decide its text: the body is written as a
   * stub, since the text JavaScript's meaning gives it may not be native's.
   */
  typeMiss: boolean
  /**
   * The nodes inside the instance being walked whose text the records row
   * chose from the instance's types, each with that text, in walk order: where
   * two instances that disagree are refused.
   */
  choiceNodes: Node[]
  choiceTexts: string[]
  /** Every name the emitted module must import from `nish/runtime`, in first-use order. */
  helpers: StringSet
  /** Every width type the module spells, in first-use order. */
  widths: StringSet
  /** Every identifier the module spells but an ambient call's callee: the names a helper must not be imported as. */
  names: StringSet
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
  /** Each declaration `stub` marked, by node id, and the name it is warned about by. */
  stubIds: i32[]
  stubNames: string[]
  /** The declarations written with a throwing body while `warnStubs` held, with the warning for each. */
  stubbedAt: Node[]
  stubWarnings: string[]
  /** An internal error the walk ran into, or the empty string. */
  failure: string
  /** The statements hoisted out of the current statement so far, in order. */
  preludes: string[]
  /** The next number `temporary` tries. */
  temps: i32
  /** The node being walked may hoist, by its position alone (`hoistChild`). */
  hoistHere: boolean
  /** What `canHoist` answers to the hook being asked about the current node. */
  hoistable: boolean
  /** An effect, a possible panic or a read of a field or an element ran in the current statement, and was not hoisted. */
  effects: boolean
  /** A local was read in the current statement, outside what was hoisted. */
  localsRead: boolean

  constructor(program: CheckedProgram, table: TypeTable, source: SourceFile, nodeCount: i32) {
    this.program = program
    this.table = table
    this.source = source
    this.instanceHead = []
    this.stubbed = []
    let i = 0
    while (i < nodeCount) {
      this.instanceHead.push(-1)
      this.stubbed.push(false)
      i = i + 1
    }
    this.instanceNext = []
    this.instances = []
    this.inInstance = false
    this.untyped = false
    this.repeat = false
    this.instanceChoice = false
    this.choiceNodes = []
    this.choiceTexts = []
    this.helpers = new StringSet()
    this.widths = new StringSet()
    this.names = new StringSet()
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
    this.stubIds = []
    this.stubNames = []
    this.warnStubs = false
    this.typeMiss = false
    this.stubbedAt = []
    this.stubWarnings = []
    this.failure = ""
    this.hoistHere = false
    this.hoistable = false
    this.effects = false
    this.localsRead = false
    this.preludes = []
    this.temps = 0
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
    for (const template of program.templateList) {
      if (template.origin === source && template.count === 0) {
        this.stub(template.decl, nodeCount, template.sourceName)
      }
    }
    // A generic method is minted per receiver; it is uninstantiated only when
    // no receiver's was ever called.
    const called = new StringSet()
    for (const template of program.methodTemplateList) {
      if (template.count > 0) {
        called.add(`${template.decl.id}`)
      }
    }
    for (const template of program.methodTemplateList) {
      if (template.origin === source && !called.has(`${template.decl.id}`)) {
        this.stub(template.decl, nodeCount, template.sourceName)
      }
    }
    // A class template no type argument list reached: every method of it, its
    // constructor, whose stub throws before any field could be read, and every
    // field initializer, whose stub throws in its place. Stubbing an
    // initializer is safe because no instance of the class is ever built, so
    // it never runs. A static member is not a template member: it is typed
    // once, outside any instance, and reaches the composer with its types.
    for (const template of program.structTemplateList) {
      if (template.origin === source && template.count === 0 && template.decl.kind === N_CLASS) {
        for (const member of template.decl.children[3].children) {
          if (member.kind === N_METHOD) {
            this.stub(member, nodeCount, `${template.sourceName}.${member.children[0].text}`)
          } else if (member.kind === N_CONSTRUCTOR) {
            this.stub(member, nodeCount, `${template.sourceName}.constructor`)
          } else if (member.kind === N_FIELD && member.children[2].kind !== N_EMPTY) {
            this.stub(member, nodeCount, `${template.sourceName}.${member.children[0].text}`)
          }
        }
      }
    }
  }

  /** Mark `decl` as written with a throwing body (`stubbed`), under the name a warning gives it. */
  stub(decl: Node, nodeCount: i32, name: string): void {
    if (decl.id >= 0 && decl.id < nodeCount) {
      this.stubbed[decl.id] = true
      this.stubIds.push(decl.id)
      this.stubNames.push(name)
    }
  }

  /** Record that a row needed `node`'s type in an untyped body and found none (`typeMiss`). */
  missType(): void {
    if (this.untyped) {
      this.typeMiss = true
    }
  }

  /**
   * `node`'s type in the checked program, or -1 when the checker recorded none,
   * which in an untyped body is a miss (`missType`): every row reads a type
   * through here, so none can take the -1 for an answer without the body
   * becoming a stub.
   */
  typeAt(node: Node): i32 {
    const types = this.program.nodeTypes
    const type = node.id >= 0 && node.id < types.length ? types[node.id] : -1
    if (type < 0) {
      this.missType()
    }
    return type
  }

  /** The name `stub` was given for the declaration with node id `id`. */
  stubName(id: i32): string {
    let i = 0
    while (i < this.stubIds.length) {
      if (this.stubIds[i] === id) {
        return this.stubNames[i]
      }
      i = i + 1
    }
    return ""
  }

  /**
   * Ask for a `nish/runtime` export by name, for a row hook whose rewrite calls
   * it, and answer the name to call it by: its own, or an alias
   * (`__nish_<name>`, numbered past any the module spells too) where the
   * module binds that name itself, so that a local `idx` or `slice` neither
   * shadows the helper nor clashes with its import. The driver puts every name
   * asked for on the module's import line, once.
   */
  helperName(name: string): string {
    if (!this.names.has(name)) {
      this.helpers.add(name)
      return name
    }
    let alias = `__nish_${name}`
    let n = 2
    while (this.names.has(alias)) {
      alias = `__nish${n}_${name}`
      n = n + 1
    }
    this.helpers.add(`${name} as ${alias}`)
    return alias
  }

  /** Whether the node a hook is asked about may put statements before its statement. */
  canHoist(): boolean {
    return this.hoistable
  }

  /**
   * A local name for a hoisted statement to bind: `__t<n>`, numbered through
   * the module, skipping any number the source already spells.
   */
  temporary(): string {
    let name = `__t${this.temps}`
    while (this.source.text.indexOf(name) >= 0) {
      this.temps = this.temps + 1
      name = `__t${this.temps}`
    }
    this.temps = this.temps + 1
    return name
  }

  /** Put `statement` before the current node's statement, after any hoisted already. */
  hoist(statement: string): void {
    if (!this.hoistable) {
      this.fail(
        `--emit-ts: a statement was hoisted from ${this.source.path} where \`canHoist\` answered false`
      )
      return
    }
    this.preludes.push(statement)
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
 * The ambient builtin `node` calls, or the empty string: a plain identifier
 * call that the checker bound to no function of the program and to no `nish:`
 * import, of a name `nish/runtime` exports.
 */
const ambientCallee = (walk: Walk, node: Node): string => {
  if (node.kind !== N_CALL || node.children.length === 0 || node.children[0].kind !== N_IDENT) {
    return ""
  }
  const program = walk.program
  const name = node.children[0].text
  if (program.nodeCallees[node.id] !== null || program.nodeBuiltins[node.id].length > 0) {
    return ""
  }
  if (!listedWord(AMBIENT_NAMES, name)) {
    return ""
  }
  // An untyped body binds no call, so a function of the program's own of an
  // ambient name looks ambient.
  if (walk.untyped) {
    walk.missType()
    return ""
  }
  return name
}

/**
 * What one node tells the driver whatever it is rewritten to: an ambient
 * builtin call needs an import, a width type an `import type`, and two
 * builtins are refused. Answers the name an ambient call's callee is written
 * as where `helperName` aliased it, else the empty string.
 */
const observe = (walk: Walk, node: Node): string => {
  if (node.kind === N_TYPE_REF && listedWord(WIDTH_TYPES, node.text)) {
    walk.widths.add(node.text)
    return ""
  }
  if (node.kind !== N_CALL || node.children.length === 0 || node.children[0].kind !== N_IDENT) {
    return ""
  }
  const program = walk.program
  if (program.nodeCallees[node.id] !== null) {
    return ""
  }
  const imported = program.nodeBuiltins[node.id]
  const name = imported.length > 0 ? imported : node.children[0].text
  // Every `nish:net` name is a global builtin too, so a call spelled without
  // the import is refused here, by the same table the checker binds it by.
  if (name === "signalFd" || name === "readSignal" || isNetExport(name)) {
    walk.refuse(node, SIGNAL_REFUSAL)
    return ""
  }
  const ambient = ambientCallee(walk, node)
  if (ambient.length === 0) {
    return ""
  }
  const local = walk.helperName(ambient)
  return local === ambient ? "" : local
}

/** Whether `call` is `r.expect(m)` or `r.unwrapOr(d)`, whose argument runs only when `r` is an `Err`. */
const isLazyCall = (call: Node): boolean => {
  const callee = call.children[0]
  return callee.kind === N_MEMBER && (callee.text === "expect" || callee.text === "unwrapOr")
}

/**
 * Whether child `i` of `node` runs exactly once, in order, whenever `node`
 * does, so that what may hoist at `node` may hoist from the child too. A kind
 * not named here keeps its children from hoisting: an arrow's body runs later,
 * a class member's initializer at construction, a loop's condition each time.
 */
const hoistChild = (node: Node, i: i32): boolean => {
  const kind = node.kind
  if (kind === N_BINARY) {
    return i === 0 || (node.text !== "&&" && node.text !== "||" && node.text !== "??")
  }
  if (kind === N_IF || kind === N_SWITCH || kind === N_FOR) {
    return i === 0
  }
  if (kind === N_FOR_OF) {
    return i < 2
  }
  // `expect` and `unwrapOr` run their argument on the `Err` path only (#182),
  // so nothing in it may hoist ahead of the call.
  if (kind === N_CALL && i > 0 && isLazyCall(node)) {
    return false
  }
  if (kind === N_CALL || kind === N_MEMBER || kind === N_INDEX) {
    return i === 0 || !inOptionalChain(node)
  }
  return (
    kind === N_VAR ||
    kind === N_MODULE_CONST ||
    kind === N_LIST ||
    kind === N_VAR_DECL ||
    kind === N_EXPR_STMT ||
    kind === N_RETURN ||
    kind === N_THROW ||
    kind === N_NEW ||
    kind === N_PAREN ||
    kind === N_UNARY ||
    kind === N_ARRAY ||
    kind === N_OBJECT ||
    kind === N_PROPERTY ||
    kind === N_TEMPLATE ||
    kind === N_AS ||
    kind === N_SPREAD
  )
}

/**
 * Whether `node` is a link of an optional chain at or past its first `?.`:
 * `a?.b`, `a?.b.c` and `a?.f(x)` are, `a.b` and `a` itself are not. Such a
 * link runs only when nothing before it in the chain was null.
 */
const inOptionalChain = (node: Node): boolean => {
  let link = node
  while (link.kind === N_CALL || link.kind === N_MEMBER || link.kind === N_INDEX) {
    if ((link.flags & FLAG_OPTIONAL) !== 0) {
      return true
    }
    link = link.children[0]
  }
  return false
}

/** Whether evaluating `node` itself, apart from its children, may have an effect. */
const hasEffect = (node: Node): boolean => {
  if (node.kind === N_CALL || node.kind === N_NEW) {
    return true
  }
  if (node.kind === N_VAR_DECL) {
    return node.children[2].kind !== N_EMPTY
  }
  if (node.kind === N_UNARY) {
    return node.text === "++" || node.text === "--"
  }
  if (node.kind !== N_BINARY) {
    return false
  }
  const op = node.text
  return (
    op.endsWith("=") &&
    op !== "==" &&
    op !== "===" &&
    op !== "!=" &&
    op !== "!==" &&
    op !== "<=" &&
    op !== ">="
  )
}

/**
 * Whether evaluating `node` itself may panic: an integer `/` or `%` whose
 * divisor is not proven nonzero, or checked signed arithmetic the bounds walk
 * did not prove fits (`checksOverflow`). A hoist past it would run the hoisted
 * call before the panic that should have stopped the statement first.
 */
const mayPanic = (walk: Walk, node: Node): boolean => {
  const program = walk.program
  if (node.kind === N_BINARY) {
    const op = node.text
    if (op === "/" || op === "%" || op === "/=" || op === "%=") {
      const left = walk.typeAt(node.children[0])
      return left >= 0 && isInteger(walk.table.baseOf(left)) && !program.nodeProvenIndex[node.id]
    }
  }
  return checksOverflow(program, walk.table, node) && !program.nodeProvenNoOverflow[node.id]
}

/**
 * Whether child `i` of `node` reads a local. The target of a plain `=` is
 * written, not read.
 */
const readsLocal = (walk: Walk, node: Node, i: i32): boolean => {
  const child = node.children[i]
  if (child.kind !== N_IDENT || walk.program.nodeLocals[child.id] === null) {
    return false
  }
  return !(i === 0 && node.kind === N_BINARY && node.text === "=")
}

/**
 * Whether `node` assigns, increments or decrements anything, outside the
 * functions inside it. Hoisting it past an earlier read of a local would let
 * the read see a write to that local; a write to a field or an element blocks
 * the hoist too, which is more than it needs.
 */
const writes = (node: Node): boolean => {
  if (node.kind === N_ARROW || node.kind === N_FUNCTION) {
    return false
  }
  if (hasEffect(node) && node.kind !== N_CALL && node.kind !== N_NEW && node.kind !== N_VAR_DECL) {
    return true
  }
  for (const child of node.children) {
    if (writes(child)) {
      return true
    }
  }
  return false
}

/**
 * Whether child `i` of `node` reads a field or an element, which a call later
 * in the statement may change. The target of a plain `=` is written, not
 * read, and a member of an enum is a constant.
 */
const readsState = (walk: Walk, node: Node, i: i32): boolean => {
  const child = node.children[i]
  if (child.kind !== N_MEMBER && child.kind !== N_INDEX) {
    return false
  }
  if (i === 0 && node.kind === N_BINARY && node.text === "=") {
    return false
  }
  const target = child.children[0]
  return !(
    child.kind === N_MEMBER &&
    target.kind === N_IDENT &&
    walk.program.nodeLocals[target.id] === null &&
    walk.program.enumNamed(target.text) !== null
  )
}

/**
 * `changedText` for a statement of a block: the statements hoisted out of it
 * are written before it, each followed by a line break and the statement's own
 * indentation, or by a space when it shares its line.
 */
const statementText = (walk: Walk, stmt: Node, out: Operands, slot: i32): void => {
  const here = walk.hoistHere
  const effects = walk.effects
  const localsRead = walk.localsRead
  const mark = walk.preludes.length
  walk.hoistHere = true
  walk.effects = false
  walk.localsRead = false
  changedText(walk, stmt, out, slot)
  walk.hoistHere = here
  walk.effects = effects
  walk.localsRead = localsRead
  if (walk.preludes.length === mark) {
    return
  }
  const text = walk.source.text
  let lineStart = stmt.start
  while (lineStart > 0 && (text.charCodeAt(lineStart - 1) === 32 || text.charCodeAt(lineStart - 1) === 9)) {
    lineStart = lineStart - 1
  }
  const ownLine = lineStart === 0 || text.charCodeAt(lineStart - 1) === 10
  const sep = ownLine ? `\n${text.substring(lineStart, stmt.start)}` : " "
  const sb = new StringBuilder()
  let k = mark
  while (k < walk.preludes.length) {
    sb.add(walk.preludes[k])
    sb.add(sep)
    k = k + 1
  }
  sb.add(out.changed[slot] ? out.texts[slot] : walk.spanOf(stmt))
  out.texts[slot] = sb.toText()
  out.changed[slot] = true
  while (walk.preludes.length > mark) {
    walk.preludes.pop()
  }
}

/**
 * Whether the text of `node`, a body no instance reaches, would need the types
 * the checker never gave it, as its spelling shows: a 64-bit integer, which is
 * a `bigint` here and mixes with no `number`, an f32, whose literals round, or
 * a builtin call, whose rewrite the checker's resolution of it decides. What
 * the spelling cannot show, a row reports as it walks (`typeMiss`).
 */
const needsTypes = (node: Node): boolean => {
  if (
    (node.kind === N_TYPE_REF || node.kind === N_IDENT) &&
    (node.text === "i64" || node.text === "u64" || node.text === "f32")
  ) {
    return true
  }
  if (node.kind === N_CALL && node.children.length > 0) {
    const callee = node.children[0]
    if (callee.kind === N_IDENT && isBuiltinFunction(callee.text)) {
      return true
    }
  }
  for (const child of node.children) {
    if (needsTypes(child)) {
      return true
    }
  }
  return false
}

/**
 * The index of the body of `node`, a function, method or constructor, or of a
 * field's initializer; -1 where it has none, as a `declare`d one.
 */
const bodyIndex = (node: Node): i32 => {
  if (node.kind === N_FIELD) {
    return node.children[2].kind !== N_EMPTY ? 2 : -1
  }
  const at = node.kind === N_CONSTRUCTOR ? 1 : 3
  return node.children.length > at && node.children[at].kind === N_BLOCK ? at : -1
}

/** The width types the signature of a stub names, which its text keeps. */
const observeWidths = (walk: Walk, node: Node): void => {
  if (node.kind === N_TYPE_REF && listedWord(WIDTH_TYPES, node.text)) {
    walk.widths.add(node.text)
  }
  for (const child of node.children) {
    observeWidths(walk, child)
  }
}

/**
 * A body no instance reaches whose text would need types (`needsTypes`,
 * `typeMiss`), or that in the standard library would choose a copy or a zero,
 * written to throw: the native build compiles none, so nothing calls it. The
 * empty string where there is no body, as a `declare`d one has none.
 */
const stubText = (walk: Walk, node: Node): string => {
  const text = walk.source.text
  if (node.kind === N_FIELD) {
    // A field's initializer: a thrown error is a `never`, which any field type takes.
    const init = node.children[2]
    return `${text.substring(node.start, init.start)}(() => {\n    throw new Error("--emit-ts: a generic no instance reaches")\n  })()${text.substring(init.end, node.end)}`
  }
  const at = bodyIndex(node)
  if (at < 0) {
    return ""
  }
  const body = node.children[at]
  return `${text.substring(node.start, body.start)}{\n    throw new Error("--emit-ts: a generic no instance reaches")\n  }${text.substring(body.end, node.end)}`
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
    !walk.untyped &&
    node.id >= 0 &&
    node.id < walk.stubbed.length &&
    walk.stubbed[node.id]
  ) {
    const choices = walk.choiceNodes.length
    // The program's own body is walked whatever its spelling, so a copy or a
    // zero in it is refused even beside a 64-bit integer or a builtin call.
    const spelled = needsTypes(node)
    let stub = spelled && !walk.warnStubs ? stubText(walk, node) : ""
    if (stub.length === 0) {
      walk.untyped = true
      walk.typeMiss = false
      changedText(walk, node, out, slot)
      walk.untyped = false
      const chose = walk.choiceNodes.length > choices
      // A copy or a zero in the program's own code is refused even where the
      // body also missed a type: almost every body misses one, and a stub
      // would hide the element type the reader has to name.
      if (chose && walk.warnStubs) {
        walk.refuse(walk.choiceNodes[choices], UNTYPED_REFUSAL)
      } else if (chose || walk.typeMiss || spelled) {
        stub = stubText(walk, node)
      }
      walk.typeMiss = false
      while (walk.choiceNodes.length > choices) {
        walk.choiceNodes.pop()
        walk.choiceTexts.pop()
      }
    }
    if (stub.length > 0) {
      if (walk.warnStubs) {
        walk.stubbedAt.push(node)
        walk.stubWarnings.push(
          `\`${walk.stubName(node.id)}\` is never instantiated, and its body needs the checker's types to translate: --emit-ts writes it as a stub that throws`
        )
      }
      const at = bodyIndex(node)
      let k = 0
      while (k < node.children.length) {
        if (k !== at) {
          observeWidths(walk, node.children[k])
        }
        k = k + 1
      }
      out.texts[slot] = stub
      out.changed[slot] = true
    }
    return
  }
  if (
    !walk.inInstance &&
    node.id >= 0 &&
    node.id < walk.instanceHead.length &&
    walk.instanceHead[node.id] >= 0
  ) {
    changedAcrossInstances(walk, node, out, slot)
    return
  }
  const callee = observe(walk, node)
  const here = walk.hoistHere
  const effectsBefore = walk.effects
  const localsBefore = walk.localsRead
  const operands = new Operands(node, walk.source.text)
  let i = 0
  while (i < node.children.length) {
    operands.texts.push("")
    operands.changed.push(false)
    if (node.kind === N_BLOCK) {
      statementText(walk, node.children[i], operands, i)
    } else {
      walk.hoistHere = here && hoistChild(node, i)
      changedText(walk, node.children[i], operands, i)
      if (readsState(walk, node, i)) {
        walk.effects = true
      }
      if (readsLocal(walk, node, i)) {
        walk.localsRead = true
      }
    }
    if (operands.changed[i]) {
      operands.any = true
    }
    i = i + 1
  }
  if (callee.length > 0) {
    operands.texts[0] = callee
    operands.changed[0] = true
    operands.any = true
  }
  walk.hoistHere = here
  walk.hoistable = here && !effectsBefore && !inOptionalChain(node) && !(localsBefore && writes(node))
  const hoisted = walk.preludes.length
  const choiceBefore = walk.instanceChoice
  walk.instanceChoice = false
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
  if (walk.instanceChoice) {
    walk.choiceNodes.push(node)
    walk.choiceTexts.push(rewritten === null ? walk.spanOf(node) : rewritten)
  }
  walk.instanceChoice = choiceBefore || walk.instanceChoice
  walk.hoistable = false
  if (walk.preludes.length > hoisted) {
    // What ran before this node ran before the statement now, so it is as if
    // nothing in the node had run yet.
    walk.effects = effectsBefore
    walk.localsRead = localsBefore
  } else if (hasEffect(node) || mayPanic(walk, node)) {
    walk.effects = true
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
 * the one written; every later one has to agree with it. A disagreement the
 * records row caused by choosing a copy or a zero per instance is refused
 * (NL4013); any other is a bug in a row, and fails.
 */
const changedAcrossInstances = (walk: Walk, node: Node, out: Operands, slot: i32): void => {
  const program = walk.program
  let k = walk.instanceHead[node.id]
  let first = true
  let firstChanged = false
  let firstText = ""
  // Every instance numbers its temporaries from the same place, or no two
  // could agree; the walk goes on from the furthest any of them reached.
  const temps = walk.temps
  let tempsAfter = temps
  const effects = walk.effects
  const localsRead = walk.localsRead
  const choiceBefore = walk.instanceChoice
  let choice = false
  // The first instance's choices, which every later one's are held to.
  const choicesFrom = walk.choiceNodes.length
  let firstChoices = choicesFrom
  while (k >= 0) {
    walk.temps = temps
    walk.effects = effects
    walk.localsRead = localsRead
    program.enterInstance(walk.instances[k])
    walk.inInstance = true
    walk.repeat = !first
    walk.instanceChoice = false
    out.texts[slot] = ""
    out.changed[slot] = false
    changedText(walk, node, out, slot)
    choice = choice || walk.instanceChoice
    walk.inInstance = false
    walk.repeat = false
    program.leaveInstance()
    if (walk.temps > tempsAfter) {
      tempsAfter = walk.temps
    }
    if (first) {
      firstChanged = out.changed[slot]
      firstText = out.texts[slot]
      firstChoices = walk.choiceNodes.length
      first = false
    } else if (!sameAnswer(firstChanged, firstText, out.changed[slot], out.texts[slot])) {
      const differs = differingChoice(walk, choicesFrom, firstChoices)
      if (choice && differs !== null) {
        // One body is written for every instance, so instances that need
        // a different copy or zero cannot all be served by it.
        walk.refuse(differs, INSTANCES_REFUSAL)
      } else {
        const at = node.start
        walk.fail(
          `--emit-ts: two instances of the generic at ${walk.source.path}:${walk.source.lineOf(at)}:${walk.source.columnOf(at)} would be written as different TypeScript`
        )
      }
      k = -1
      continue
    }
    if (!first) {
      // A later instance's choices were compared; only the first's are kept.
      while (walk.choiceNodes.length > firstChoices) {
        walk.choiceNodes.pop()
        walk.choiceTexts.pop()
      }
    }
    k = walk.instanceNext[k]
  }
  while (walk.choiceNodes.length > choicesFrom) {
    walk.choiceNodes.pop()
    walk.choiceTexts.pop()
  }
  walk.instanceChoice = choiceBefore
  walk.temps = tempsAfter
  out.texts[slot] = firstText
  out.changed[slot] = firstChanged
}

/**
 * The first node at which the instance just walked chose other text than the
 * first instance did, whose choices are `walk.choiceNodes[from..firstEnd)` and
 * the just-walked one's those after; or `null` where every choice agrees.
 */
const differingChoice = (walk: Walk, from: i32, firstEnd: i32): Node | null => {
  const count = firstEnd - from
  let i = 0
  while (i < count && firstEnd + i < walk.choiceNodes.length) {
    if (walk.choiceTexts[from + i] !== walk.choiceTexts[firstEnd + i]) {
      return walk.choiceNodes[firstEnd + i]
    }
    i = i + 1
  }
  return null
}

/**
 * `node`'s source span with each changed child replaced by its text. Children
 * are spliced front to back; one that does not lie inside its parent, after
 * the previous one, cannot be placed, and that is an internal error rather
 * than a guess at where it goes.
 */
export const splice = (walk: Walk, node: Node, operands: Operands): string => {
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
 * Add every identifier spelled under `node` to `walk.names`, but for the
 * callee of an ambient call, which names the helper itself rather than a
 * binding of the module.
 */
const collectNames = (walk: Walk, node: Node): void => {
  if (node.kind === N_IDENT || node.kind === N_IMPORT_SPEC) {
    walk.names.add(node.text)
  }
  const ambient = ambientCallee(walk, node).length > 0
  let i = 0
  while (i < node.children.length) {
    if (!(ambient && i === 0)) {
      collectNames(walk, node.children[i])
    }
    i = i + 1
  }
}

/** Whether `name` from `specifier` is a builtin read as a property, which a call must stand in for. */
const isPropertyExport = (specifier: string, name: string): boolean => {
  const builtin = nishExport(specifier, name)
  return builtin !== null && builtin.isProperty
}

/**
 * The bindings after a builtin import whose names are values rather than
 * functions: `argv` from `nish:process` is the command line, and the runtime
 * exports it as the function that reads it. Each such name is imported under
 * `__nish_<local>` (an edit pushed here; numbered past a name the module
 * already holds, and held from then on, so a helper the rows import later
 * cannot take it) and bound by the text this answers,
 * `const argv = __nish_argv();`, which goes after the import.
 */
const propertyImports = (walk: Walk, stmt: Node, edits: Edit[]): string => {
  if (
    !isBuiltinSpecifier(stmt.text) ||
    stmt.children.length === 0 ||
    stmt.children[0].kind !== N_LIST ||
    (stmt.flags & FLAG_TYPE_ONLY) !== 0
  ) {
    return ""
  }
  const sb = new StringBuilder()
  for (const spec of stmt.children[0].children) {
    if (spec.kind !== N_IMPORT_SPEC || (spec.flags & FLAG_TYPE_ONLY) !== 0) {
      continue
    }
    const exported = spec.children.length > 0 ? spec.children[0].text : spec.text
    if (!isPropertyExport(stmt.text, exported)) {
      continue
    }
    let alias = `__nish_${spec.text}`
    let n = 2
    while (walk.names.has(alias)) {
      alias = `__nish${n}_${spec.text}`
      n = n + 1
    }
    walk.names.add(alias)
    edits.push(new Edit(spec.start, spec.end, `${exported} as ${alias}`))
    sb.add(`\nconst ${spec.text} = ${alias}();`)
  }
  return sb.toText()
}

/**
 * Walk the module's top-level statements and collect their edits, front to
 * back: `type` before an imported name that is only a type (`typeNames`), a
 * rewritten import specifier (from `specifierFrom`), and each statement that
 * comes back with other text. The refusals that need no walk,
 * a `declare function`, are recorded here too.
 */
export const emitModule = (walk: Walk, file: Node, edits: Edit[]): void => {
  collectNames(walk, file)
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
      const values = propertyImports(walk, stmt, edits)
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
      if (values.length > 0) {
        edits.push(new Edit(stmt.end, stmt.end, values))
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
