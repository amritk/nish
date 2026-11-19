// `nish c-import`: a C header becomes a checked-in Nish module of
// `declare function`s, `declare class`es, out classes and `export const`s,
// with a report of what it could not bind (WP66 S2, docs/wp66-c-headers.md
// §5–§7).
//
// Nothing here parses C. clang reads the header and this file reads clang's
// answers: `-ast-dump=json` for the declarations, `-E -dD` for the list of
// macros, and a second `-ast-dump=json` over a probe file that asks clang to
// evaluate each object-like macro as an enumerator (§4.3). clang is run with an
// argument vector through `spawnSyncTo`, never through a shell, so a header path
// is one argument whatever it holds; the probe and clang's output are files in a
// scratch directory beside the module, since the compiler also links as one
// WASI module, where `spawnPiped` is refused.
//
// The output uses only what the language already has (§2.1). What it cannot
// say — a function pointer, a variadic, a struct by value, `short` (D4) — is
// left out and listed in the `Not bound` block at the end, with the reason,
// so the file says what the library offers that the binding does not. The
// target's data model is written in the header comment, and
// `src/compilation.ts` refuses the module in a build for the other model (D3,
// `src/c-import-model.ts`).
// The security record is `docs/security/c-import.md`.

import { CLI } from "./branding"
import { StringMap, StringSet } from "./map"
import { basename, dirname } from "./paths"
import { StringBuilder, hexOfI64, splitByte } from "./strings"
import { resolveTarget } from "./target"
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_MAX_VALUES,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
} from "nish/json-value"
import { JsonLimits } from "nish/json-tokenizer"
import { C_IMPORT_MARKER, DATA_MODEL_LINE, dataModelOf } from "./c-import-model"

/** How many macros one probe run evaluates. */
const PROBE_BATCH: i32 = 64

/** How many probe passes may drop macros clang refuses before the rest are given up. */
const PROBE_PASSES: i32 = 8

/** The usage line. */
const USAGE: string = "c-import <header> [--overrides <file>] [--target <triple>] -o <file>"

// What a C type's innermost, unpointed-to part is.
const BASE_VOID: i32 = 0
const BASE_SCALAR: i32 = 1
const BASE_CHAR: i32 = 2
const BASE_RECORD: i32 = 3
const BASE_FNPTR: i32 = 4
const BASE_FUNC: i32 = 5
const BASE_ARRAY: i32 = 6
const BASE_REFUSED: i32 = 7

// A `char`'s signedness as spelled.
const CHAR_PLAIN: i32 = 0
const CHAR_SIGNED: i32 = 1
const CHAR_UNSIGNED: i32 = 2

// What an override says about a result.
const RETURN_DEFAULT: i32 = 0
const RETURN_NONNULL: i32 = 1
const RETURN_NULLABLE: i32 = 2
const RETURN_OWNED: i32 = 3

// A struct's `fits` state while it is being decided.
const FIT_UNKNOWN: i32 = 0
const FIT_DECIDING: i32 = 1
const FIT_YES: i32 = 2
const FIT_NO: i32 = 3

/** The words a parameter may not be named; each gets a trailing `_`. */
const isCReservedWord = (name: string): boolean =>
  name === "in" ||
  name === "of" ||
  name === "new" ||
  name === "var" ||
  name === "let" ||
  name === "for" ||
  name === "try" ||
  name === "case" ||
  name === "this" ||
  name === "void" ||
  name === "null" ||
  name === "true" ||
  name === "type" ||
  name === "with" ||
  name === "enum" ||
  name === "false" ||
  name === "class" ||
  name === "const" ||
  name === "super" ||
  name === "throw" ||
  name === "yield" ||
  name === "await" ||
  name === "string" ||
  name === "number" ||
  name === "delete" ||
  name === "export" ||
  name === "import" ||
  name === "public" ||
  name === "static" ||
  name === "switch" ||
  name === "typeof" ||
  name === "default" ||
  name === "extends" ||
  name === "finally" ||
  name === "package" ||
  name === "private" ||
  name === "boolean" ||
  name === "function" ||
  name === "continue" ||
  name === "debugger" ||
  name === "interface" ||
  name === "protected" ||
  name === "implements" ||
  name === "instanceof"

/** A C name as a Nish identifier: a reserved word gets a trailing `_`. */
const nishName = (name: string): string => (isCReservedWord(name) ? `${name}_` : name)

/** `s` without the spaces and tabs at either end. */
const trimSpaces = (s: string): string => {
  let start = 0
  let end = s.length
  while (start < end && (s.charCodeAt(start) === 32 || s.charCodeAt(start) === 9)) {
    start++
  }
  while (end > start && (s.charCodeAt(end - 1) === 32 || s.charCodeAt(end - 1) === 9)) {
    end--
  }
  return s.slice(start, end)
}

/** Whether `c` may continue a C identifier. */
const isIdentByte = (c: i32): boolean =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95

/** A type spelling as words, with each `*` a word of its own. */
const typeWords = (spelling: string): string[] => {
  const words: string[] = []
  let start = 0
  for (let i = 0; i <= spelling.length; i++) {
    const c = i < spelling.length ? spelling.charCodeAt(i) : 32
    if (c === 32 || c === 42) {
      if (i > start) {
        words.push(spelling.slice(start, i))
      }
      if (c === 42) {
        words.push("*")
      }
      start = i + 1
    }
  }
  return words
}

/** A decimal integer clang printed, with an optional sign. */
const parseI64 = (s: string): i64 => {
  let value: i64 = 0
  let negative = false
  let i = 0
  if (s.length > 0 && s.charCodeAt(0) === 45) {
    negative = true
    i = 1
  }
  while (i < s.length) {
    const c = s.charCodeAt(i)
    if (c < 48 || c > 57) {
      break
    }
    value = value * 10 + toI64(c - 48)
    i++
  }
  return negative ? -value : value
}

/** Whether `name` matches `glob`, where `*` is any run of bytes and `?` is one. */
const globMatches = (glob: string, name: string): boolean => {
  let g = 0
  let n = 0
  let star = -1
  let mark = 0
  while (n < name.length) {
    const gc = g < glob.length ? glob.charCodeAt(g) : -1
    if (gc === 63 || (gc >= 0 && gc !== 42 && gc === name.charCodeAt(n))) {
      g++
      n++
    } else if (gc === 42) {
      star = g
      mark = n
      g++
    } else if (star >= 0) {
      g = star + 1
      mark++
      n = mark
    } else {
      return false
    }
  }
  while (g < glob.length && glob.charCodeAt(g) === 42) {
    g++
  }
  return g === glob.length
}

/**
 * Whether `path` holds what its place in the output cannot carry: the probe
 * names the header in an `#include "..."` line, and the module names every
 * path in a `//` comment, which a control byte, U+2028 or U+2029 would end.
 */
const unsafePath = (path: string): boolean => {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    if (c < 32 || c === 127 || c === 34 || c === 92) {
      return true
    }
  }
  return path.indexOf("\u2028") >= 0 || path.indexOf("\u2029") >= 0
}

/** The text of `bytes`. */
const clangText = (bytes: u8[]): string => String.fromBytes(bytes, 0, bytes.length)

/** One run of clang: its status and what it wrote. */
class ClangRun {
  status: i32 = 0
  out: u8[]
  err: u8[]

  constructor() {
    this.out = []
    this.err = []
  }
}

/** The C compiler `nish build` uses: `$CC`, else `clang`. */
const importCompiler = (): string => {
  const cc = getenv("CC")
  return cc === null || cc.length === 0 ? "clang" : cc
}

/** The most a clang run may write to either stream. */
const CLANG_OUTPUT_MAX: i64 = 16777216

/** The bytes of `path`, or null when it cannot be read or holds more than `CLANG_OUTPUT_MAX`. */
const readCapped = (path: string): u8[] | null => {
  const fd = fileOpen(path)
  if (fd < 0) {
    return null
  }
  const size = fileSize(fd)
  fileClose(fd)
  return size < 0 || size > CLANG_OUTPUT_MAX ? null : readFileBytesSync(path)
}

/**
 * Runs `argv` with its two output streams sent to files in `scratch`: -1 when
 * it cannot start, -2 when either stream is past `CLANG_OUTPUT_MAX`.
 */
const runClang = (argv: string[], scratch: string): ClangRun => {
  const run = new ClangRun()
  run.status = toI32(spawnSyncTo(argv, `${scratch}/out`, `${scratch}/err`))
  if (run.status === -1) {
    return run
  }
  const out = readCapped(`${scratch}/out`)
  const err = readCapped(`${scratch}/err`)
  if (out === null || err === null) {
    run.status = -2
    return run
  }
  run.out = out
  run.err = err
  return run
}

/**
 * A new directory beside `out`, mode 0700, for the probe and clang's output,
 * or "" when none can be made. `mkdir` refuses a name already taken, so a
 * symbolic link planted there is never followed.
 */
const scratchBeside = (out: string): string => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const dir = `${dirname(out)}/.nish-c-import-${hexOfI64(monotonicNanos(), 16)}`
    if (mkdirSyncMode(dir, 448) === 0) {
      return dir
    }
  }
  return ""
}

/** A C type read from clang's spelling of it. */
class CType {
  base: i32
  /** The Nish scalar for `BASE_SCALAR`. */
  scalar: string = ""
  /** `CHAR_*` for `BASE_CHAR`. */
  sign: i32
  /** `struct x` or `union x` for `BASE_RECORD`. */
  tag: string = ""
  pointers: i32 = 0
  /** Whether the innermost pointed-to type is `const`. */
  constBase: boolean = false
  nullable: boolean = false
  nonnull: boolean = false
  /** Why it has no Nish type, for `BASE_REFUSED`. */
  reason: string = ""

  constructor() {
    this.base = BASE_REFUSED
    this.sign = CHAR_PLAIN
  }
}

/** A refused type with its reason. */
const refusedType = (reason: string): CType => {
  const t = new CType()
  t.reason = reason
  return t
}

/** A struct or union declared in the header or one it includes. */
class CRecord {
  key: string = ""
  className: string = ""
  isUnion: boolean = false
  complete: boolean = false
  inHeader: boolean = false
  fieldNames: string[]
  fieldTypes: string[]
  fieldBitfields: boolean[]
  fit: i32
  /** Why it is not a `declare class`, once `fit` is `FIT_NO`. */
  why: string = ""

  constructor() {
    this.fieldNames = []
    this.fieldTypes = []
    this.fieldBitfields = []
    this.fit = FIT_UNKNOWN
  }
}

/** An enum: its underlying type's spelling and its enumerators. */
class CEnum {
  name: string = ""
  underlying: string = ""
  inHeader: boolean = false
  constNames: string[]
  constValues: i64[]

  constructor() {
    this.constNames = []
    this.constValues = []
  }
}

/** A function declaration, the first one clang saw for the name. */
class CFunc {
  name: string = ""
  qualType: string = ""
  variadic: boolean = false
  noSymbol: boolean = false
  inHeader: boolean = false
  returnsNonNull: boolean = false
  paramNames: string[]
  paramTypes: string[]

  constructor() {
    this.paramNames = []
    this.paramTypes = []
  }
}

/** An object-like macro in the header's own file. */
class CMacro {
  name: string = ""
  body: string = ""
  /** Why it is not a constant; empty while it still may be. */
  why: string = ""
  value: i64 = 0
  type: string = ""
}

/** What the override file says about one function. */
class FnOverride {
  name: string = ""
  returnMode: i32
  ownedBy: string = ""
  params: string[]
  buffers: string[]
  readonlys: boolean[]
  nullables: boolean[]

  constructor() {
    this.returnMode = RETURN_DEFAULT
    this.params = []
    this.buffers = []
    this.readonlys = []
    this.nullables = []
  }
}

/** The parsed command line: `status` is the exit status when it is already answered, else -1. */
class CImportArgs {
  status: i32 = -1
  header: string = ""
  overrides: string = ""
  target: string = "host"
  out: string = ""
}

/** A usage error: the message and the usage line, status 2. */
const usageError = (args: CImportArgs, message: string): CImportArgs => {
  console.error(`c-import: ${message}`)
  console.error(`usage: ${CLI} ${USAGE}`)
  args.status = 2
  return args
}

/** Reads `nish c-import`'s arguments, which follow `c-import` in `argv`. */
const parseArgs = (argv: string[]): CImportArgs => {
  const args = new CImportArgs()
  let i = 2
  while (i < argv.length) {
    const arg = argv[i]
    const value = i + 1 < argv.length ? argv[i + 1] : ""
    if (arg === "--help" || arg === "-h") {
      console.log(`usage: ${CLI} ${USAGE}`)
      console.log("  writes a Nish module of declare functions, classes and consts from a C header,")
      console.log("  with the functions it cannot bind listed at its end")
      console.log(
        "  --overrides <file>  the JSON that names what the header cannot say (buffers, nullability)"
      )
      console.log("  --target <triple>   the target whose ABI the module is for (default: host)")
      args.status = 0
      return args
    }
    if (arg === "-o" || arg === "--overrides" || arg === "--target") {
      if (i + 1 >= argv.length) {
        return usageError(args, `${arg} needs a value`)
      }
      if (arg === "-o") {
        args.out = value
      } else if (arg === "--overrides") {
        args.overrides = value
      } else {
        args.target = value
      }
      i += 2
    } else if (arg.startsWith("-")) {
      return usageError(args, `unknown flag ${arg}`)
    } else if (args.header.length > 0) {
      return usageError(args, "one header at most")
    } else {
      args.header = arg
      i++
    }
  }
  if (args.header.length === 0) {
    return usageError(args, "no header given")
  }
  if (args.out.length === 0) {
    return usageError(args, "no output file given (-o)")
  }
  return args
}

/** A JSON document sized for a header's AST. */
const newDocument = (): JsonDocument => {
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = JSON_VALUE_MAX_VALUES
  return doc
}

/** The whole import: clang's answers, the tables built from them, and the module. */
class Importer {
  doc: JsonDocument
  triple: string
  lp64: boolean
  charUnsigned: boolean
  headerAbs: string
  cc: string
  /** The directory `scratchBeside` made for this import. */
  scratch: string = ""
  failure: string = ""
  /** The status `failure` exits with. */
  failureStatus: i32 = 1
  curFile: string = ""
  typedefs: StringMap
  typedefTypes: string[]
  tags: StringMap
  recordIds: StringMap
  enumIds: StringMap
  enumTags: StringMap
  records: CRecord[]
  enums: CEnum[]
  funcs: CFunc[]
  funcIndex: StringMap
  macros: CMacro[]
  macroIndex: StringMap
  overrides: FnOverride[]
  overrideIndex: StringMap
  allow: string[]
  hasAllow: boolean = false
  usedOut: StringSet
  /** The out classes the function being declared needs, kept only if it is bound. */
  pendingOut: string[]

  constructor(triple: string, headerAbs: string) {
    this.typedefs = new StringMap()
    this.typedefTypes = []
    this.tags = new StringMap()
    this.recordIds = new StringMap()
    this.enumIds = new StringMap()
    this.enumTags = new StringMap()
    this.records = []
    this.enums = []
    this.funcs = []
    this.funcIndex = new StringMap()
    this.macros = []
    this.macroIndex = new StringMap()
    this.overrides = []
    this.overrideIndex = new StringMap()
    this.allow = []
    this.usedOut = new StringSet()
    this.pendingOut = []
    this.doc = newDocument()
    this.triple = triple
    this.lp64 = dataModelOf(triple) === "LP64"
    // Plain `char` is unsigned only on aarch64 Linux among the targets; elsewhere
    // it is signed, and Nish has no `i8` (D4).
    this.charUnsigned = triple === "aarch64-unknown-linux-gnu"
    this.headerAbs = headerAbs
    this.cc = importCompiler()
  }

  /** Records the first failure; the import stops at it. */
  fail(message: string, status: i32): void {
    if (this.failure.length === 0) {
      this.failure = message
      this.failureStatus = status
    }
  }

  /** Runs clang, recording a failure when it cannot start or answers too much. */
  clang(argv: string[], input: string): ClangRun {
    if (input.length > 0 && writeFileSyncMode(this.probePath(), input, 384) < 0) {
      this.fail(`cannot write the macro probe in ${this.scratch}`, 1)
      return new ClangRun()
    }
    const run = runClang(argv, this.scratch)
    if (run.status === -1) {
      this.fail(`cannot run ${this.cc}; install clang or set CC`, 3)
    } else if (run.status === -2) {
      this.fail(`${this.cc} wrote more than 16 MiB for ${this.headerAbs}`, 1)
    }
    return run
  }

  // ---- JSON access ----

  member(v: i32, key: string): i32 {
    if (v < 0 || this.doc.kind(v) !== JSON_VALUE_OBJECT) {
      return -1
    }
    return this.doc.get(v, key)
  }

  text(v: i32, key: string): string {
    const x = this.member(v, key)
    return x >= 0 && this.doc.kind(x) === JSON_VALUE_STRING ? this.doc.string(x) : ""
  }

  flag(v: i32, key: string): boolean {
    const x = this.member(v, key)
    return x >= 0 && this.doc.kind(x) === JSON_VALUE_BOOLEAN && this.doc.boolean(x)
  }

  /** The children of `v`'s `inner`, or -1 when it has none. */
  inner(v: i32): i32 {
    const x = this.member(v, "inner")
    return x >= 0 && this.doc.kind(x) === JSON_VALUE_ARRAY ? x : -1
  }

  count(array: i32): i32 {
    return array < 0 ? 0 : this.doc.length(array)
  }

  qualType(v: i32): string {
    return this.text(this.member(v, "type"), "qualType")
  }

  // ---- The file each declaration is in ----
  //
  // clang writes a location's `file` only when it differs from the last one it
  // wrote, in document order, so the current file is a state carried through
  // every location of every node, in the order the JSON holds them.

  trackLoc(loc: i32): void {
    if (loc < 0) {
      return
    }
    this.trackLoc(this.member(loc, "spellingLoc"))
    this.trackLoc(this.member(loc, "expansionLoc"))
    const file = this.text(loc, "file")
    if (file.length > 0) {
      this.curFile = file
    }
  }

  /** Carries the file state through `node`'s range and its children. */
  trackRest(node: i32): void {
    const range = this.member(node, "range")
    this.trackLoc(this.member(range, "begin"))
    this.trackLoc(this.member(range, "end"))
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      this.trackLoc(this.member(child, "loc"))
      this.trackRest(child)
    }
  }

  // ---- Reading the AST ----

  /** Parses clang's JSON in `bytes`, recording a failure when it cannot. */
  parse(bytes: u8[], what: string): i32 {
    this.doc.clear()
    const root = this.doc.parse(bytes, 0, bytes.length)
    if (root < 0) {
      this.fail(`cannot read clang's AST of ${what} (deeper than 64 or more than 4194304 values)`, 1)
    }
    return root
  }

  /** The AST of the header at `source`. */
  dumpAst(source: string): ClangRun {
    const argv: string[] = [
      this.cc,
      "-Xclang",
      "-ast-dump=json",
      "-fsyntax-only",
      "-fno-caret-diagnostics",
      `--target=${this.triple}`,
      "-x",
      "c",
      source,
    ]
    return this.clang(argv, "")
  }

  readHeader(): void {
    const run = this.dumpAst(this.headerAbs)
    if (this.failure.length > 0) {
      return
    }
    if (run.status !== 0) {
      this.fail(`clang refused ${this.headerAbs}:\n${clangText(run.err)}`, 1)
      return
    }
    const root = this.parse(run.out, this.headerAbs)
    if (root < 0) {
      return
    }
    const decls = this.inner(root)
    const n = this.count(decls)
    for (let i = 0; i < n; i++) {
      const node = this.doc.at(decls, i)
      this.trackLoc(this.member(node, "loc"))
      const inHeader = this.curFile === this.headerAbs
      const kind = this.text(node, "kind")
      if (kind === "TypedefDecl") {
        this.readTypedef(node)
      } else if (kind === "RecordDecl") {
        this.readRecord(node, inHeader)
      } else if (kind === "EnumDecl") {
        this.readEnum(node, inHeader)
      } else if (kind === "FunctionDecl") {
        this.readFunction(node, inHeader)
      }
      this.trackRest(node)
    }
  }

  readTypedef(node: i32): void {
    const name = this.text(node, "name")
    // C11 lets a typedef be declared again (`typedef T T;`), always as the
    // type it already names: the first is kept, so a typedef's type names
    // only typedefs declared before it and following them ends.
    if (this.typedefs.get(name, -1) >= 0) {
      return
    }
    this.typedefs.set(name, this.typedefTypes.length)
    this.typedefTypes.push(this.qualType(node))
    // `typedef struct { ... } name;`: the tag has no name of its own, and
    // clang spells it `struct name` from here on.
    const owned = this.member(this.doc.at(this.inner(node), 0), "ownedTagDecl")
    if (owned < 0 || this.text(owned, "name").length > 0) {
      return
    }
    const id = this.text(owned, "id")
    const record = this.recordIds.get(id, -1)
    if (record >= 0 && record < this.records.length) {
      const r = this.records[record]
      r.key = `${r.isUnion ? "union" : "struct"} ${name}`
      r.className = name
      this.tags.set(r.key, record)
    }
    const e = this.enumIds.get(id, -1)
    if (e >= 0) {
      this.enumTags.set(`enum ${name}`, e)
    }
  }

  readRecord(node: i32, inHeader: boolean): void {
    const name = this.text(node, "name")
    const isUnion = this.text(node, "tagUsed") === "union"
    const key = name.length > 0 ? `${isUnion ? "union" : "struct"} ${name}` : ""
    const complete = this.flag(node, "completeDefinition")
    let index = key.length > 0 ? this.tags.get(key, -1) : -1
    if (index < 0 || index >= this.records.length) {
      index = this.records.length
      const fresh = new CRecord()
      fresh.key = key
      fresh.className = name
      fresh.isUnion = isUnion
      this.records.push(fresh)
      if (key.length > 0) {
        this.tags.set(key, index)
      }
    }
    this.recordIds.set(this.text(node, "id"), index)
    const r = this.records[index]
    if (!complete || r.complete) {
      return
    }
    r.complete = true
    r.inHeader = inHeader
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      const kind = this.text(child, "kind")
      if (kind === "FieldDecl") {
        r.fieldNames.push(this.text(child, "name"))
        r.fieldTypes.push(this.qualType(child))
        r.fieldBitfields.push(this.flag(child, "isBitfield"))
      } else if (kind === "RecordDecl") {
        this.readRecord(child, inHeader)
      }
    }
  }

  readEnum(node: i32, inHeader: boolean): void {
    const e = new CEnum()
    e.name = this.text(node, "name")
    e.underlying = this.text(this.member(node, "fixedUnderlyingType"), "qualType")
    e.inHeader = inHeader
    const index = this.enums.length
    this.enums.push(e)
    this.enumIds.set(this.text(node, "id"), index)
    if (e.name.length > 0) {
      this.enumTags.set(`enum ${e.name}`, index)
    }
    let next: i64 = 0
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      if (this.text(child, "kind") === "EnumConstantDecl") {
        const value = this.text(this.doc.at(this.inner(child), 0), "value")
        const v = value.length > 0 ? parseI64(value) : next
        e.constNames.push(this.text(child, "name"))
        e.constValues.push(v)
        next = v + 1
      }
    }
  }

  readFunction(node: i32, inHeader: boolean): void {
    const name = this.text(node, "name")
    if (this.funcIndex.has(name)) {
      return
    }
    const f = new CFunc()
    f.name = name
    f.qualType = this.qualType(node)
    f.variadic = this.flag(node, "variadic")
    f.noSymbol = this.text(node, "storageClass") === "static" || this.flag(node, "inline")
    f.inHeader = inHeader
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      const kind = this.text(child, "kind")
      if (kind === "ParmVarDecl") {
        const pname = this.text(child, "name")
        f.paramNames.push(pname.length > 0 ? pname : `arg${f.paramNames.length}`)
        f.paramTypes.push(this.qualType(child))
      } else if (kind === "CompoundStmt") {
        f.noSymbol = true
      } else if (kind === "ReturnsNonNullAttr") {
        f.returnsNonNull = true
      }
    }
    this.funcIndex.set(name, this.funcs.length)
    this.funcs.push(f)
  }

  // ---- Types ----

  /** The C type clang spells `spelling`, following typedefs. */
  resolve(spelling: string): CType {
    if (spelling.indexOf("(*") >= 0 || spelling.indexOf("(^") >= 0) {
      const fn = new CType()
      fn.base = BASE_FNPTR
      return fn
    }
    if (spelling.indexOf("(") >= 0) {
      const fn = new CType()
      fn.base = BASE_FUNC
      return fn
    }
    if (spelling.indexOf("[") >= 0) {
      const array = new CType()
      array.base = BASE_ARRAY
      return array
    }
    const words = typeWords(spelling)
    let pointers = 0
    let constBase = false
    let nullable = false
    let nonnull = false
    let tagWord = ""
    let tagName = ""
    let named = ""
    let longs = 0
    let isUnsigned = false
    let isSigned = false
    let builtin = ""
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      if (
        w.length === 0 ||
        w === "volatile" ||
        w === "restrict" ||
        w === "__restrict" ||
        w === "_Null_unspecified"
      ) {
        continue
      }
      if (tagWord.length > 0 && tagName.length === 0) {
        tagName = w
      } else if (w === "*") {
        pointers++
      } else if (w === "const") {
        constBase = constBase || pointers === 0
      } else if (w === "_Nullable") {
        nullable = true
      } else if (w === "_Nonnull") {
        nonnull = true
      } else if (w === "struct" || w === "union" || w === "enum") {
        tagWord = w
      } else if (w === "long") {
        longs++
      } else if (w === "unsigned") {
        isUnsigned = true
      } else if (w === "signed") {
        isSigned = true
      } else if (
        w === "int" ||
        w === "char" ||
        w === "short" ||
        w === "float" ||
        w === "double" ||
        w === "void" ||
        w === "_Bool" ||
        w === "__int128" ||
        w === "_Complex" ||
        w === "_Float16" ||
        w === "__fp16" ||
        w === "__bf16"
      ) {
        builtin = builtin === "double" || builtin === "float" ? builtin : w
      } else {
        named = w
      }
    }
    let t = new CType()
    if (tagWord === "enum") {
      t = this.enumType(tagName)
    } else if (tagWord.length > 0) {
      t.base = BASE_RECORD
      t.tag = `${tagWord} ${tagName}`
    } else if (named.length > 0) {
      if (named.indexOf("va_list") >= 0) {
        return refusedType("a `va_list`")
      }
      const index = this.typedefs.get(named, -1)
      if (index < 0 || index >= this.typedefTypes.length) {
        return refusedType(`the unknown type \`${named}\``)
      }
      t = this.resolve(this.typedefTypes[index])
      if (t.pointers === 0) {
        t.constBase = t.constBase || constBase
      }
      t.pointers += pointers
      t.nullable = t.nullable || nullable
      t.nonnull = t.nonnull || nonnull
      return t
    } else {
      t = this.builtinType(builtin, longs, isUnsigned, isSigned)
    }
    t.pointers = pointers
    t.constBase = constBase
    t.nullable = nullable
    t.nonnull = nonnull
    return t
  }

  /** The scalar an enum's values have: its fixed underlying type, else `int`. */
  enumType(name: string): CType {
    const index = this.enumTags.get(`enum ${name}`, -1)
    if (index >= 0 && index < this.enums.length) {
      const underlying = this.enums[index].underlying
      if (underlying.length > 0) {
        return this.resolve(underlying)
      }
    }
    const t = new CType()
    t.base = BASE_SCALAR
    t.scalar = "i32"
    return t
  }

  builtinType(builtin: string, longs: i32, isUnsigned: boolean, isSigned: boolean): CType {
    const t = new CType()
    t.base = BASE_SCALAR
    if (builtin === "void") {
      t.base = BASE_VOID
    } else if (builtin === "_Bool") {
      t.scalar = "boolean"
    } else if (builtin === "char") {
      t.base = BASE_CHAR
      t.sign = CHAR_PLAIN
      if (isUnsigned) {
        t.sign = CHAR_UNSIGNED
      } else if (isSigned) {
        t.sign = CHAR_SIGNED
      }
    } else if (builtin === "short") {
      if (!isUnsigned) {
        return refusedType("`short`, which has no Nish type")
      }
      t.scalar = "u16"
    } else if (builtin === "double") {
      if (longs > 0) {
        return refusedType("`long double`")
      }
      t.scalar = "f64"
    } else if (builtin === "float") {
      t.scalar = "f32"
    } else if (builtin === "__int128" || builtin === "_Complex") {
      return refusedType(`\`${builtin}\``)
    } else if (builtin.length > 0 && builtin !== "int") {
      return refusedType("a half-precision float")
    } else if (longs === 0 && builtin.length === 0 && !isUnsigned && !isSigned) {
      return refusedType("a type the generator cannot read")
    } else if (longs === 2 || (longs === 1 && this.lp64)) {
      t.scalar = isUnsigned ? "u64" : "i64"
    } else {
      t.scalar = isUnsigned ? "u32" : "i32"
    }
    return t
  }

  /** The record a `struct x` names, or -1. */
  recordOf(tag: string): i32 {
    const index = this.tags.get(tag, -1)
    return index >= 0 && index < this.records.length ? index : -1
  }

  /** The Nish type of a value of type `t` (no pointer), or `!` and the reason it has none. */
  valueType(t: CType): string {
    if (t.base === BASE_VOID) {
      return "void"
    }
    if (t.base === BASE_SCALAR) {
      return t.scalar
    }
    if (t.base === BASE_CHAR) {
      if (t.sign === CHAR_UNSIGNED || (t.sign === CHAR_PLAIN && this.charUnsigned)) {
        return "u8"
      }
      if (t.sign === CHAR_SIGNED) {
        return "!`signed char`, which has no Nish type"
      }
      return `!plain \`char\`, which is signed on ${this.triple} and has no Nish type`
    }
    if (t.base === BASE_RECORD) {
      return `!a ${t.tag.startsWith("union") ? "union" : "struct"} passed by value`
    }
    if (t.base === BASE_FNPTR || t.base === BASE_FUNC) {
      return "!a function pointer"
    }
    if (t.base === BASE_ARRAY) {
      return "!an array"
    }
    return `!${t.reason}`
  }

  /** Whether the struct `index` can be a `declare class`, deciding it once. */
  fits(index: i32): boolean {
    if (index < 0 || index >= this.records.length) {
      return false
    }
    const r = this.records[index]
    if (r.fit === FIT_UNKNOWN) {
      r.fit = FIT_DECIDING
      r.why = this.whyNotClass(r)
      r.fit = r.why.length === 0 ? FIT_YES : FIT_NO
    }
    return r.fit === FIT_YES
  }

  /** Why a struct cannot be a `declare class`, or the empty string when it can. */
  whyNotClass(r: CRecord): string {
    if (r.isUnion) {
      return "a union, which has no Nish type"
    }
    if (!r.complete || !r.inHeader) {
      return "not defined in the header"
    }
    if (r.fieldNames.length === 0) {
      return "no fields"
    }
    for (let i = 0; i < r.fieldNames.length && i < r.fieldTypes.length && i < r.fieldBitfields.length; i++) {
      const field = `field \`${r.fieldNames[i]}\` is `
      if (r.fieldNames[i].length === 0) {
        return "an anonymous member"
      }
      if (r.fieldBitfields[i]) {
        return `${field}a bitfield`
      }
      const type = this.fieldType(this.resolve(r.fieldTypes[i]))
      if (type.startsWith("!")) {
        return `${field}${type.slice(1)}`
      }
    }
    return ""
  }

  /** The Nish type of a struct field, or `!` and the reason it has none. */
  fieldType(t: CType): string {
    if (t.base === BASE_FNPTR || (t.pointers > 0 && t.base !== BASE_REFUSED)) {
      return "CPtr | null"
    }
    if (t.base === BASE_RECORD) {
      const index = this.recordOf(t.tag)
      if (index >= 0 && this.records[index].fit === FIT_DECIDING) {
        return "!the struct itself"
      }
      if (this.fits(index)) {
        return this.records[index].className
      }
      return `!a struct that is not a declare class (\`${t.tag}\`)`
    }
    const value = this.valueType(t)
    if (value === "boolean") {
      return "!a `_Bool`, which a declare class cannot hold"
    }
    return value
  }

  /** The out class for a pointer to a scalar, noting that the module needs it. */
  outClass(scalar: string): string {
    const name =
      scalar === "ptr" ? "OutPtr" : `Out${String.fromCharCode(scalar.charCodeAt(0) - 32)}${scalar.slice(1)}`
    this.pendingOut.push(name)
    return name
  }

  /** The Nish type of a parameter of type `t`, or `!` and the reason it has none. */
  paramType(t: CType, nullable: boolean, nonnull: boolean): string {
    if (t.pointers === 0) {
      if (t.base === BASE_VOID) {
        return "!`void`"
      }
      return this.valueType(t)
    }
    if (t.base === BASE_REFUSED) {
      return `!a pointer to ${t.reason}`
    }
    const orNull = nullable || (t.nullable && !nonnull) ? " | null" : ""
    if (t.pointers >= 3) {
      return "CPtr | null"
    }
    if (t.pointers === 2 || t.base === BASE_FNPTR) {
      return this.outClass("ptr")
    }
    if (t.base === BASE_CHAR) {
      if (t.sign === CHAR_PLAIN) {
        return t.constBase ? `string${orNull}` : `CPtr${orNull}`
      }
      return nonnull || t.nonnull ? "CPtr" : "CPtr | null"
    }
    if (t.base === BASE_VOID) {
      return nonnull || t.nonnull ? "CPtr" : "CPtr | null"
    }
    if (t.base === BASE_SCALAR) {
      if (t.scalar === "boolean") {
        return "!a pointer to `_Bool`"
      }
      return this.outClass(t.scalar)
    }
    if (t.base === BASE_RECORD) {
      const index = this.recordOf(t.tag)
      if (this.fits(index)) {
        return `${this.records[index].className}${orNull}`
      }
      return `CPtr${orNull}`
    }
    if (t.base === BASE_FUNC) {
      return "!a function pointer"
    }
    return "!a pointer to an array"
  }

  /** The Nish type of a result of type `t`, or `!` and the reason it has none. */
  returnType(t: CType, mode: i32, headerNonNull: boolean): string {
    if (t.pointers === 0) {
      return this.valueType(t)
    }
    if (t.base === BASE_REFUSED) {
      return `!a pointer to ${t.reason}`
    }
    if (mode === RETURN_OWNED) {
      return "CPtr | null"
    }
    const nonnull = mode === RETURN_NONNULL || (mode === RETURN_DEFAULT && (headerNonNull || t.nonnull))
    if (t.pointers === 1 && t.base === BASE_CHAR && t.sign === CHAR_PLAIN && t.constBase) {
      return nonnull ? "string" : "string | null"
    }
    return nonnull ? "CPtr" : "CPtr | null"
  }

  // ---- Macros ----

  /** The object-like macros the header's own file defines, from `clang -E -dD`. */
  readMacros(): void {
    const argv: string[] = [this.cc, "-E", "-dD", `--target=${this.triple}`, "-x", "c", this.headerAbs]
    const run = this.clang(argv, "")
    if (this.failure.length > 0) {
      return
    }
    if (run.status !== 0) {
      this.fail(`clang refused ${this.headerAbs}:\n${clangText(run.err)}`, 1)
      return
    }
    const lines = splitByte(clangText(run.out), 10)
    let file = ""
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith("# ")) {
        const open = line.indexOf('"')
        const close = line.indexOf('"', open + 1)
        if (open > 0 && close > open) {
          file = line.slice(open + 1, close)
        }
      } else if (file === this.headerAbs && line.startsWith("#define ")) {
        this.readDefine(line.slice(8))
      }
    }
  }

  readDefine(rest: string): void {
    let end = 0
    while (end < rest.length && isIdentByte(rest.charCodeAt(end))) {
      end++
    }
    const name = rest.slice(0, end)
    if (name.length === 0 || name.startsWith("_")) {
      return
    }
    let index = this.macroIndex.get(name, -1)
    if (index < 0 || index >= this.macros.length) {
      index = this.macros.length
      const fresh = new CMacro()
      fresh.name = name
      this.macros.push(fresh)
      this.macroIndex.set(name, index)
    }
    const m = this.macros[index]
    m.why = ""
    m.body = trimSpaces(rest.slice(end))
    if (end < rest.length && rest.charCodeAt(end) === 40) {
      m.why = "a function-like macro"
    } else if (m.body.length === 0) {
      m.why = "an empty macro"
    } else if (m.body.startsWith('"')) {
      const plain =
        m.body.endsWith('"') && m.body.indexOf('"', 1) === m.body.length - 1 && m.body.indexOf("\\") < 0
      m.type = "string"
      m.why = plain ? "" : "a string the generator does not copy (escapes or pieces)"
    }
  }

  /** The probe source: the header, then one enum per macro still in the running. */
  probeText(lines: i32[], start: i32, end: i32): string {
    const out = new StringBuilder()
    out.add(`#include "${this.headerAbs}"\n`)
    for (let i = start; i < end && i < this.macros.length; i++) {
      const m = this.macros[i]
      if (m.why.length === 0 && m.type !== "string") {
        lines.push(i)
        const n = m.name
        out.add(
          `enum : long long { __nish_v_${n} = (long long)(${n}), __nish_c_${n} = __builtin_classify_type(${n}),`
        )
        out.add(` __nish_s_${n} = sizeof(${n}), __nish_u_${n} = ((__typeof__(${n}))-1 > 0) };\n`)
      }
    }
    return out.toText()
  }

  /** The probe's file, which clang reads and names in its diagnostics. */
  probePath(): string {
    return `${this.scratch}/probe.c`
  }

  probeArgs(dump: boolean): string[] {
    const argv: string[] = [this.cc]
    if (dump) {
      argv.push("-Xclang")
      argv.push("-ast-dump=json")
    }
    argv.push("-fsyntax-only")
    argv.push("-fno-caret-diagnostics")
    argv.push("-ferror-limit=0")
    argv.push("-w")
    argv.push(`--target=${this.triple}`)
    argv.push("-x")
    argv.push("c")
    argv.push(this.probePath())
    return argv
  }

  /**
   * Evaluates each remaining macro through clang. A pass that clang refuses
   * drops every macro its diagnostics name a probe line of and runs again.
   */
  probeMacros(): void {
    for (let start = 0; start < this.macros.length && this.failure.length === 0; start += PROBE_BATCH) {
      this.probeBatch(start, start + PROBE_BATCH)
    }
  }

  /**
   * Probes the macros in `[start, end)`. Batches keep each dump small: clang
   * writes about 37 KiB of AST per probed macro, and sqlite3.h has 510.
   */
  probeBatch(start: i32, end: i32): void {
    for (let pass = 0; pass < PROBE_PASSES; pass++) {
      const lines: i32[] = []
      const text = this.probeText(lines, start, end)
      if (lines.length === 0) {
        return
      }
      const run = this.clang(this.probeArgs(false), text)
      if (this.failure.length > 0) {
        return
      }
      if (run.status === 0) {
        this.readProbe(text, start, end)
        return
      }
      let dropped = 0
      const errors = splitByte(clangText(run.err), 10)
      const prefix = `${this.probePath()}:`
      for (let i = 0; i < errors.length; i++) {
        const e = errors[i]
        if (e.startsWith(prefix)) {
          const line = toI32(parseI64(e.slice(prefix.length))) - 2
          if (line >= 0 && line < lines.length) {
            const index = lines[line]
            if (index >= 0 && index < this.macros.length && this.macros[index].why.length === 0) {
              this.macros[index].why = "not an integer constant"
              dropped++
            }
          }
        }
      }
      if (dropped === 0) {
        break
      }
    }
    for (let i = start; i < end && i < this.macros.length; i++) {
      const m = this.macros[i]
      if (m.why.length === 0 && m.type !== "string") {
        m.why = "not an integer constant"
      }
    }
  }

  /** Reads the values clang gave the probe's enumerators for `[start, end)`. */
  readProbe(text: string, start: i32, end: i32): void {
    const run = this.clang(this.probeArgs(true), text)
    if (this.failure.length > 0) {
      return
    }
    const root = this.parse(run.out, "the macro probe")
    if (root < 0) {
      return
    }
    const values = new StringMap()
    const texts: string[] = []
    const decls = this.inner(root)
    const n = this.count(decls)
    for (let i = 0; i < n; i++) {
      const node = this.doc.at(decls, i)
      if (this.text(node, "kind") === "EnumDecl") {
        const children = this.inner(node)
        const m = this.count(children)
        for (let j = 0; j < m; j++) {
          const child = this.doc.at(children, j)
          const name = this.text(child, "name")
          if (name.startsWith("__nish_")) {
            values.set(name, texts.length)
            texts.push(this.constantValue(child))
          }
        }
      }
    }
    for (let i = start; i < end && i < this.macros.length; i++) {
      const m = this.macros[i]
      if (m.why.length === 0 && m.type !== "string") {
        this.typeMacro(m, values, texts)
      }
    }
  }

  /**
   * The value clang folded an enumerator to: on its ConstantExpr, which an
   * implicit cast to the enum's type can wrap. Empty when there is none.
   */
  constantValue(decl: i32): string {
    let node = decl
    for (let depth = 0; depth < 4; depth++) {
      const inner = this.inner(node)
      if (this.count(inner) === 0) {
        return ""
      }
      node = this.doc.at(inner, 0)
      const value = this.text(node, "value")
      if (value.length > 0) {
        return value
      }
    }
    return ""
  }

  /** A probed macro's value and type, from its four enumerators. */
  typeMacro(m: CMacro, values: StringMap, texts: string[]): void {
    const v = values.get(`__nish_v_${m.name}`, -1)
    const c = values.get(`__nish_c_${m.name}`, -1)
    const s = values.get(`__nish_s_${m.name}`, -1)
    const u = values.get(`__nish_u_${m.name}`, -1)
    if (
      v < 0 ||
      c < 0 ||
      s < 0 ||
      u < 0 ||
      v >= texts.length ||
      c >= texts.length ||
      s >= texts.length ||
      u >= texts.length
    ) {
      m.why = "not an integer constant"
      return
    }
    const kind = parseI64(texts[c])
    if (kind === 8) {
      m.why = "a floating-point constant"
      return
    }
    if (kind < 1 || kind > 4) {
      m.why = "not an integer constant"
      return
    }
    m.value = parseI64(texts[v])
    const size = parseI64(texts[s])
    const unsigned = parseI64(texts[u]) !== 0
    if (size === 8) {
      m.type = unsigned ? "u64" : "i64"
      if (unsigned && m.value < 0) {
        m.why = "an unsigned value above 2^63, which a Nish literal does not hold"
      }
    } else {
      m.type = size === 4 && unsigned ? "u32" : "i32"
    }
  }

  // ---- Overrides (§7) ----

  /** Reads the override file; a mistake in it is a failure, never a no-op. */
  readOverrides(path: string, headerName: string): void {
    const text = readFileSyncOrNull(path)
    if (text === null) {
      this.fail(`cannot read ${path}`, 1)
      return
    }
    this.doc.clear()
    const root = this.doc.parseText(text)
    if (root < 0 || this.doc.kind(root) !== JSON_VALUE_OBJECT) {
      this.fail(`overrides: ${path} is not a JSON object`, 1)
      return
    }
    for (let i = 0; i < this.doc.length(root); i++) {
      const key = this.doc.keyAt(root, i)
      const value = this.doc.at(root, i)
      if (key === "header") {
        if (this.doc.kind(value) !== JSON_VALUE_STRING || this.doc.string(value) !== headerName) {
          this.fail(`overrides: "header" must be "${headerName}"`, 1)
        }
      } else if (key === "allow") {
        this.readAllow(value)
      } else if (key === "functions") {
        this.readFunctionOverrides(value)
      } else {
        this.fail(`overrides: unknown key "${key}"`, 1)
      }
    }
  }

  readAllow(value: i32): void {
    if (this.doc.kind(value) !== JSON_VALUE_ARRAY) {
      this.fail('overrides: "allow" must be an array of name globs', 1)
      return
    }
    this.hasAllow = true
    for (let i = 0; i < this.doc.length(value); i++) {
      const glob = this.doc.at(value, i)
      if (this.doc.kind(glob) !== JSON_VALUE_STRING) {
        this.fail('overrides: "allow" must be an array of name globs', 1)
        return
      }
      this.allow.push(this.doc.string(glob))
    }
  }

  readFunctionOverrides(value: i32): void {
    if (this.doc.kind(value) !== JSON_VALUE_OBJECT) {
      this.fail('overrides: "functions" must be an object', 1)
      return
    }
    for (let i = 0; i < this.doc.length(value); i++) {
      const name = this.doc.keyAt(value, i)
      const body = this.doc.at(value, i)
      const index = this.funcIndex.get(name, -1)
      if (index < 0 || index >= this.funcs.length) {
        this.fail(`overrides: \`${name}\` is not a function the header declares`, 1)
        return
      }
      if (this.doc.kind(body) !== JSON_VALUE_OBJECT) {
        this.fail(`overrides: \`${name}\` must be an object`, 1)
        return
      }
      const o = new FnOverride()
      o.name = name
      this.overrideIndex.set(name, this.overrides.length)
      this.overrides.push(o)
      const f = this.funcs[index]
      for (let j = 0; j < this.doc.length(body); j++) {
        const key = this.doc.keyAt(body, j)
        if (key === "return") {
          this.readReturnOverride(o, this.doc.at(body, j))
          const result = this.functionReturn(f, null)
          if (result.indexOf("CPtr") !== 0 && result.indexOf("string") !== 0) {
            this.fail(`overrides: \`${name}\` does not return a pointer, so "return" cannot apply`, 1)
            return
          }
        } else {
          this.readParamOverride(f, o, key, this.doc.at(body, j))
        }
      }
    }
  }

  readReturnOverride(o: FnOverride, value: i32): void {
    const kind = this.doc.kind(value)
    if (kind === JSON_VALUE_STRING && this.doc.stringEquals(value, "nonnull")) {
      o.returnMode = RETURN_NONNULL
      return
    }
    if (kind === JSON_VALUE_STRING && this.doc.stringEquals(value, "nullable")) {
      o.returnMode = RETURN_NULLABLE
      return
    }
    const owner = this.text(value, "owned")
    if (kind === JSON_VALUE_OBJECT && this.doc.length(value) === 1 && owner.length > 0) {
      if (!this.funcIndex.has(owner)) {
        this.fail(`overrides: \`${o.name}\` is freed by \`${owner}\`, which the header does not declare`, 1)
        return
      }
      o.returnMode = RETURN_OWNED
      o.ownedBy = owner
      return
    }
    this.fail(
      `overrides: \`${o.name}\` "return" must be "nonnull", "nullable" or { "owned": "<function>" }`,
      1
    )
  }

  readParamOverride(f: CFunc, o: FnOverride, param: string, value: i32): void {
    let at = -1
    for (let i = 0; i < f.paramNames.length; i++) {
      if (f.paramNames[i] === param) {
        at = i
      }
    }
    const where = `\`${f.name}\` parameter \`${param}\``
    if (at < 0 || at >= f.paramTypes.length) {
      this.fail(`overrides: \`${f.name}\` has no parameter \`${param}\``, 1)
      return
    }
    if (this.doc.kind(value) !== JSON_VALUE_OBJECT) {
      this.fail(`overrides: ${where} must be an object`, 1)
      return
    }
    let buffer = ""
    let readonly = false
    let nullable = false
    for (let i = 0; i < this.doc.length(value); i++) {
      const key = this.doc.keyAt(value, i)
      const v = this.doc.at(value, i)
      const isBool = this.doc.kind(v) === JSON_VALUE_BOOLEAN
      if (key === "buffer" && this.doc.kind(v) === JSON_VALUE_STRING) {
        buffer = this.doc.string(v)
      } else if (key === "readonly" && isBool) {
        readonly = this.doc.boolean(v)
      } else if (key === "nullable" && isBool) {
        nullable = this.doc.boolean(v)
      } else {
        this.fail(`overrides: ${where}: unknown or mistyped key "${key}"`, 1)
        return
      }
    }
    const t = this.resolve(f.paramTypes[at])
    if (nullable && t.pointers === 0) {
      this.fail(`overrides: ${where} is not a pointer, so it cannot be nullable`, 1)
      return
    }
    if (buffer.length > 0) {
      if (t.pointers !== 1 || (t.base !== BASE_VOID && t.base !== BASE_CHAR)) {
        this.fail(`overrides: ${where} is a buffer, so it must be a \`void *\` or \`char *\``, 1)
        return
      }
      if (readonly && !t.constBase) {
        this.fail(`overrides: ${where} is readonly, but the header lets the function write it`, 1)
        return
      }
      const count = at + 1 < f.paramNames.length && at + 1 < f.paramTypes.length ? f.paramNames[at + 1] : ""
      const countType = count === buffer ? this.resolve(f.paramTypes[at + 1]) : new CType()
      if (
        count !== buffer ||
        countType.pointers > 0 ||
        (countType.scalar !== "u64" && countType.scalar !== "i64")
      ) {
        this.fail(
          `overrides: ${where}'s count \`${buffer}\` must be the next parameter, a 64-bit integer passed by value (other pairings are not bound yet)`,
          1
        )
        return
      }
      readonly = t.constBase
    } else if (readonly) {
      this.fail(`overrides: ${where} is readonly but not a buffer`, 1)
      return
    }
    o.params.push(param)
    o.buffers.push(buffer)
    o.readonlys.push(readonly)
    o.nullables.push(nullable)
  }

  /** The override of `name`'s parameter `param`, as an index into its lists, or -1. */
  paramOverride(o: FnOverride | null, param: string): i32 {
    if (o === null) {
      return -1
    }
    for (let i = 0; i < o.params.length; i++) {
      if (o.params[i] === param) {
        return i
      }
    }
    return -1
  }

  // ---- The module ----

  /** Whether the function is one the module binds or reports. */
  selected(f: CFunc): boolean {
    if (!this.hasAllow) {
      return f.inHeader
    }
    for (let i = 0; i < this.allow.length; i++) {
      if (globMatches(this.allow[i], f.name)) {
        return true
      }
    }
    return false
  }

  /** The declaration of `f`, or `!` and the reason it is not bound. */
  functionDecl(f: CFunc): string {
    if (f.noSymbol) {
      return "!has no symbol to link (static or inline)"
    }
    if (f.variadic) {
      return "!variadic"
    }
    const oi = this.overrideIndex.get(f.name, -1)
    const o: FnOverride | null = oi >= 0 && oi < this.overrides.length ? this.overrides[oi] : null
    const params = new StringBuilder()
    let counts = ""
    for (let i = 0; i < f.paramNames.length && i < f.paramTypes.length; i++) {
      const name = f.paramNames[i]
      const p = this.paramOverride(o, name)
      let type = ""
      if (o !== null && p >= 0 && p < o.buffers.length && o.buffers[p].length > 0) {
        type = o.readonlys[p] ? "readonly u8[]" : "u8[]"
        counts = `${counts},${o.buffers[p]},`
      } else if (counts.indexOf(`,${name},`) >= 0) {
        type = "u64"
      } else {
        const nullable = o !== null && p >= 0 && p < o.nullables.length && o.nullables[p]
        type = this.paramType(this.resolve(f.paramTypes[i]), nullable, false)
      }
      if (type.startsWith("!")) {
        return `!parameter \`${name}\` is ${type.slice(1)}`
      }
      if (i > 0) {
        params.add(", ")
      }
      params.add(`${nishName(name)}: ${type}`)
    }
    const ret = this.functionReturn(f, o)
    if (ret.startsWith("!")) {
      return `!returns ${ret.slice(1)}`
    }
    const owned =
      o !== null && o.returnMode === RETURN_OWNED
        ? `// The result is owned: free it with ${o.ownedBy}.\n`
        : ""
    return `${owned}declare function ${f.name}(${params.toText()}): ${ret}`
  }

  /** The Nish type of `f`'s result, read from the part of its type before its parameter list. */
  functionReturn(f: CFunc, o: FnOverride | null): string {
    let depth = 0
    let open = -1
    for (let i = f.qualType.length - 1; i >= 0 && open < 0; i--) {
      const c = f.qualType.charCodeAt(i)
      if (c === 41) {
        depth++
      } else if (c === 40) {
        depth--
        if (depth === 0) {
          open = i
        }
      }
    }
    const spelling = trimSpaces(f.qualType.slice(0, open < 0 ? 0 : open))
    if (spelling.indexOf("(") >= 0) {
      return "!a function pointer"
    }
    const mode = o === null ? RETURN_DEFAULT : o.returnMode
    return this.returnType(this.resolve(spelling), mode, f.returnsNonNull)
  }

  /** Writes the `declare class` of record `index` after the classes it embeds. */
  emitClass(index: i32, out: StringBuilder, done: StringSet): void {
    if (index < 0 || index >= this.records.length) {
      return
    }
    const r = this.records[index]
    if (done.has(r.key) || !this.fits(index)) {
      return
    }
    done.add(r.key)
    const fields: string[] = []
    for (let i = 0; i < r.fieldNames.length && i < r.fieldTypes.length; i++) {
      const t = this.resolve(r.fieldTypes[i])
      if (t.base === BASE_RECORD && t.pointers === 0) {
        this.emitClass(this.recordOf(t.tag), out, done)
      }
      fields.push(`  ${r.fieldNames[i]}: ${this.fieldType(t)}\n`)
    }
    out.add(`declare class ${r.className} {\n`)
    for (let i = 0; i < fields.length; i++) {
      out.add(fields[i])
    }
    out.add("}\n\n")
  }

  /** Writes `export const name: type = value` unless the name is already taken. */
  constDecl(name: string, value: i64, type: string, out: StringBuilder, names: StringSet): void {
    if (names.has(name)) {
      return
    }
    names.add(name)
    out.add(`export const ${name}: ${type} = ${value}\n`)
  }

  /** The type of an enumerator: the enum's fixed type, else `i32` when the value fits. */
  enumConstType(e: CEnum, value: i64): string {
    if (e.underlying.length > 0) {
      const t = this.resolve(e.underlying)
      return t.pointers === 0 && t.base === BASE_SCALAR && t.scalar !== "boolean" ? t.scalar : ""
    }
    return value >= -2147483648 && value <= 2147483647 ? "i32" : "i64"
  }

  /** The whole generated module. */
  emit(args: CImportArgs): string {
    const out = new StringBuilder()
    const regenerate = new StringBuilder()
    regenerate.add(`${CLI} c-import ${args.header}`)
    if (args.overrides.length > 0) {
      regenerate.add(` --overrides ${args.overrides}`)
    }
    regenerate.add(` --target ${this.triple} -o ${basename(args.out)}`)
    out.add(`${C_IMPORT_MARKER} from ${args.header}. Do not edit; regenerate it.\n`)
    out.add(`// Target: ${this.triple}\n`)
    out.add(`${DATA_MODEL_LINE}${dataModelOf(this.triple)}\n`)
    out.add(`// Regenerate: ${regenerate.toText()}\n\n`)

    const report: string[] = []
    const functions = new StringBuilder()
    for (let i = 0; i < this.funcs.length; i++) {
      const f = this.funcs[i]
      if (this.selected(f)) {
        this.pendingOut = []
        const decl = this.functionDecl(f)
        if (decl.startsWith("!")) {
          report.push(`${f.name}: ${decl.slice(1)}`)
        } else {
          functions.add(`${decl}\n`)
          for (let j = 0; j < this.pendingOut.length; j++) {
            this.usedOut.add(this.pendingOut[j])
          }
        }
      }
    }

    const outs: string[] = [
      "OutPtr",
      "OutI32",
      "OutU32",
      "OutI64",
      "OutU64",
      "OutU8",
      "OutU16",
      "OutF32",
      "OutF64",
    ]
    for (let i = 0; i < outs.length; i++) {
      const name = outs[i]
      if (this.usedOut.has(name)) {
        const type =
          name === "OutPtr"
            ? "CPtr | null"
            : `${String.fromCharCode(name.charCodeAt(3) + 32)}${name.slice(4)}`
        out.add(`declare class ${name} {\n  value: ${type}\n}\n\n`)
      }
    }

    const done = new StringSet()
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i]
      if (r.inHeader && r.complete && r.className.length > 0) {
        if (this.fits(i)) {
          this.emitClass(i, out, done)
        } else {
          report.push(`${r.key}: ${r.why}`)
        }
      }
    }

    const names = new StringSet()
    const consts = new StringBuilder()
    for (let i = 0; i < this.enums.length; i++) {
      const e = this.enums[i]
      for (let j = 0; e.inHeader && j < e.constNames.length && j < e.constValues.length; j++) {
        const type = this.enumConstType(e, e.constValues[j])
        if (type.length > 0) {
          this.constDecl(e.constNames[j], e.constValues[j], type, consts, names)
        } else {
          report.push(`${e.constNames[j]}: an enumerator of a type that has no Nish scalar`)
        }
      }
    }
    for (let i = 0; i < this.macros.length; i++) {
      const m = this.macros[i]
      if (m.why.length > 0) {
        report.push(`${m.name}: ${m.why}`)
      } else if (m.type === "string") {
        if (!names.has(m.name)) {
          names.add(m.name)
          consts.add(`export const ${m.name}: string = ${m.body}\n`)
        }
      } else {
        this.constDecl(m.name, m.value, m.type, consts, names)
      }
    }
    if (!consts.isEmpty()) {
      out.add(consts.toText())
      out.add("\n")
    }
    out.add(functions.toText())
    if (report.length > 0) {
      out.add("\n/* Not bound:\n")
      for (let i = 0; i < report.length; i++) {
        out.add(` *   ${report[i]}\n`)
      }
      out.add(" */\n")
    }
    return out.toText()
  }
}

/**
 * `nish c-import <header> [--overrides <file>] [--target <triple>] -o <file>`:
 * writes the Nish module for a C header.
 *
 * @returns the exit status: 0 written, 1 refused, 2 a usage error, 3 no clang.
 */
export const cImport = (): i32 => {
  const args = parseArgs(process.argv)
  if (args.status >= 0) {
    return args.status
  }
  const target = resolveTarget(args.target)
  if (target === null) {
    usageError(args, `unknown target ${args.target}`)
    return 2
  }
  const headerAbs = realpathSync(args.header)
  if (headerAbs === null) {
    console.error(`c-import: cannot read ${args.header}`)
    return 1
  }
  if (
    unsafePath(headerAbs) ||
    unsafePath(args.header) ||
    unsafePath(args.overrides) ||
    unsafePath(args.out)
  ) {
    console.error(
      "c-import: a path holds a quote, a backslash or a line break, which the module cannot carry"
    )
    return 1
  }
  const scratch = scratchBeside(args.out)
  if (scratch.length === 0) {
    console.error(`c-import: cannot create a scratch directory beside ${args.out}`)
    return 1
  }
  const importer = new Importer(target.triple, headerAbs)
  importer.scratch = scratch
  importer.readHeader()
  if (importer.failure.length === 0) {
    importer.readMacros()
  }
  if (importer.failure.length === 0) {
    importer.probeMacros()
  }
  if (importer.failure.length === 0 && args.overrides.length > 0) {
    importer.readOverrides(args.overrides, basename(args.header))
  }
  spawnSync(["rm", "-rf", "--", scratch])
  if (importer.failure.length > 0) {
    console.error(`c-import: ${importer.failure}`)
    return importer.failureStatus
  }
  writeFileSync(args.out, importer.emit(args))
  return 0
}
