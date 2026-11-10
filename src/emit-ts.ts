// `--emit-ts <dir>` (wp33 §3): the checked program written back out as
// TypeScript that Node runs with its type stripping, one file per module.
//
// The root package's modules keep their paths relative to the directory they
// share; every standard-library module the program reaches is written under
// `nish/` beside them, so a `nish/x` import becomes a relative one and the
// output needs nothing installed but the runtime. A `nish:` builtin import
// becomes `nish/runtime`, the one package the output names, and so does
// `nish:secret`, whose `std/secret.ts` is not written. Last comes
// `entry.ts`, the launcher: it installs the Node host, calls `main` and exits
// with what it answered, which a module cannot do for itself because Nish's
// `main` is called, not run at load. An entry written as top-level code is
// written back as it was, and the launcher only imports it.
//
// What a module says is decided by the composer (`src/emit-ts-edits.ts`); this
// file decides where it goes, what its imports name, and whether it may be
// written at all. A module the composer refuses leaves nothing written: one
// that declares C functions (NL4010), whose bodies are not in the program, one
// that uses a builtin whose translation would reach past its own statement
// (NL4011), a compound assignment whose index would run twice (NL4012), and a
// generic whose instances would be written differently (NL4013), or one no
// instance reaches whose body makes such a choice (NL4014). A generic of the
// program's own that no instance reaches, written with a throwing body, is
// written and warned about (NL8012); one of the standard library's is not.

import { CLI } from "./branding"
import { Compilation, ModuleUnit } from "./compilation"
import { Edit } from "./diagnostics"
import { internalErrorFor } from "./ice"
import {
  applyModuleEdits,
  emitModule,
  HOST_HANDLE_ALIAS,
  REGION_REFUSAL,
  SIGNAL_REFUSAL,
  Walk,
} from "./emit-ts-edits"
import { STORAGE_FILE, STORAGE_NAMESPACE, storageFileText } from "./emit-ts-storage"
import { storageLayouts } from "./interop-wasm"
import { StringSet } from "./map"
import { Lexer } from "./lexer"
import { scriptMain } from "./script"
import { isBuiltinSpecifier, REGION_SPECIFIER, SECRET_SPECIFIER } from "./nish-modules"
import {
  FLAG_ASYNC,
  FLAG_EXPORTED,
  FLAG_SCRIPT,
  N_CLASS,
  N_ENUM,
  N_EXPORT_ASSIGNMENT,
  N_EXPORT_DECLARATION,
  N_FUNCTION,
  N_IMPORT,
  N_IMPORT_EQUALS,
  N_INTERFACE,
  N_MODULE_CONST,
  N_TYPE_ALIAS,
  Node,
} from "./nodes"
import { ROOT_PACKAGE } from "./packages"
import { dirname, joinPath, normalizePath, relativePath, resolvePath } from "./paths"
import { isMathModule } from "./std-modules"
import { StringBuilder } from "./strings"

/** The specifier every emitted module imports the runtime by. */
const RUNTIME: string = "nish/runtime"

/** The launcher's file name, which a root module may not also be written as. */
const ENTRY_FILE: string = "entry.ts"

/** The specifier the corpus refuses whole (NL4011). */
const NET_SPECIFIER: string = "nish:net"
/**
 * `nish:async` and the file the output reads it from: not `nish/runtime`,
 * where `spawn` is `nish:process`'s (`runtime/async.mjs`).
 */
const ASYNC_SPECIFIER: string = "nish:async"
const ASYNC_RUNTIME: string = "nish/runtime/async.mjs"

/** One file `--emit-ts` writes: a path relative to the output directory, and its text. */
export class EmittedFile {
  path: string
  text: string

  constructor(path: string, text: string) {
    this.path = path
    this.text = text
  }
}

/**
 * What `emitTypeScript` answers. `refused` means a diagnostic was reported and
 * nothing may be written; `unwritable` says why the program's files cannot be
 * laid out under one directory, for the driver's usage exit; `internal` is a
 * broken invariant, for the driver's internal-error exit. None set, `files` is
 * the whole output.
 */
export class EmittedProgram {
  files: EmittedFile[]
  refused: boolean
  unwritable: string
  internal: string

  constructor() {
    this.files = []
    this.refused = false
    this.unwritable = ""
    this.internal = ""
  }
}

/**
 * The directory `a` and `b` both lie in: their longest common prefix, cut back
 * to the last `/` that ends a whole segment of both. Two relative paths with no
 * segment in common lie in `.`, two absolute ones in `/`.
 */
const commonDirectory = (a: string, b: string): string => {
  if (a === b) {
    return a
  }
  let i = 0
  let cut = 0
  while (i < a.length && i < b.length && a.charCodeAt(i) === b.charCodeAt(i)) {
    if (a.charCodeAt(i) === 47) {
      cut = i
    }
    i = i + 1
  }
  const whole =
    (i === a.length && i < b.length && b.charCodeAt(i) === 47) ||
    (i === b.length && i < a.length && a.charCodeAt(i) === 47)
  if (whole) {
    return i === a.length ? a : b
  }
  if (cut === 0) {
    return a.charCodeAt(0) === 47 ? "/" : "."
  }
  return a.substring(0, cut)
}

/**
 * Where `unit` is written, relative to the output directory, or the empty
 * string for a module that is not written: a dependency package's, which the
 * program imports from where it is installed, or a host module.
 */
const outputPathOf = (unit: ModuleUnit, base: string): string => {
  // A host module is the page's own TypeScript (WP50 §3), imported from where
  // it is rather than copied, as the wasm loader passes it.
  if (unit.source.host) {
    return ""
  }
  if (unit.packageName === ROOT_PACKAGE) {
    return relativePath(base, unit.path)
  }
  // `std/secret.ts` is the meaning of `nish:secret`, not its body: its `wipe`
  // is lowered natively and empty here, so the runtime's answers the import.
  if (unit.packageName === CLI && unit.name === "std/secret.ts") {
    return ""
  }
  if (unit.packageName === CLI && unit.name.startsWith("std/")) {
    return `nish/${unit.name.substring(4)}`
  }
  return ""
}

/** Whether `list` holds `text`. */
const holds = (list: string[], text: string): boolean => {
  for (const item of list) {
    if (item === text) {
      return true
    }
  }
  return false
}

/** `to` as a specifier written in a file at `from`, both output paths. */
const relativeSpecifier = (from: string, to: string): string => {
  const path = relativePath(dirname(from), to)
  return path.startsWith("../") ? path : `./${path}`
}

/** Whether `file` imports or exports anything, which makes it a module to tsc rather than a script. */
const isModule = (file: Node): boolean => {
  for (const stmt of file.children) {
    const kind = stmt.kind
    if (
      kind === N_IMPORT ||
      kind === N_IMPORT_EQUALS ||
      kind === N_EXPORT_ASSIGNMENT ||
      kind === N_EXPORT_DECLARATION
    ) {
      return true
    }
    const declares =
      kind === N_FUNCTION ||
      kind === N_CLASS ||
      kind === N_INTERFACE ||
      kind === N_MODULE_CONST ||
      kind === N_TYPE_ALIAS ||
      kind === N_ENUM
    // The `main` a script's top-level code is moved into (`src/script.ts`) is
    // exported in the tree but not in the text.
    if (declares && (stmt.flags & FLAG_EXPORTED) !== 0 && (stmt.flags & FLAG_SCRIPT) === 0) {
      return true
    }
  }
  return false
}

/**
 * The byte offset an import line goes at: the start of the line after the last
 * line of the module's leading trivia that holds a comment or the shebang, so
 * a module's header stays its first lines and a `#!` stays at byte 0. Where
 * the trivia ends is the lexer's answer, a shebang included; this only walks
 * the bytes it skipped to find their line ends, none inside a block comment. A
 * comment that ends mid-line, with code after it, keeps the import above its
 * line, so the import never splits a line.
 */
const importOffset = (text: string): i32 => {
  const lexer = new Lexer(text)
  let at = lexer.pos
  lexer.skipTrivia()
  const first = lexer.pos
  // Past a shebang the lexer stands on its newline; the import goes after it.
  let after = 0
  let marked = at > 0
  while (at >= 0 && at < first && at < text.length) {
    const c = text.charCodeAt(at)
    if (c === 10) {
      at = at + 1
      if (marked) {
        after = at
        marked = false
      }
    } else if (text.substring(at, at + 2) === "//") {
      const end = text.indexOf("\n", at)
      at = end < 0 || end > first ? first : end
      marked = true
    } else if (text.substring(at, at + 2) === "/*") {
      const close = text.indexOf("*/", at + 2)
      at = close < 0 || close + 2 > first ? first : close + 2
      marked = true
    } else {
      at = at + 1
    }
  }
  return after
}

/** `names` as a brace list: `{ a, b }`. */
const braceList = (names: StringSet): string => {
  const sb = new StringBuilder()
  sb.add("{ ")
  let i = 0
  while (i < names.size()) {
    if (i > 0) {
      sb.add(", ")
    }
    sb.add(names.at(i))
    i = i + 1
  }
  sb.add(" }")
  return sb.toText()
}

/** The line a module that writes a storage `new` imports `STORAGE_FILE` with, from `out`. */
const storageImport = (out: string): string =>
  `import * as ${STORAGE_NAMESPACE} from "${relativeSpecifier(out, STORAGE_FILE)}"\n`

/** The line a non-empty name list is imported from the runtime by, or the empty string. */
const runtimeImport = (keyword: string, names: StringSet): string =>
  names.size() === 0 ? "" : `${keyword} ${braceList(names)} from "${RUNTIME}"\n`

/**
 * The import line of what `--deterministic` routed to `nish/math`, from where
 * `out` is written to where the math library is (`outputPathOf`). A name with
 * no `nish/math` module to import it from stops the compile with an internal
 * error (exit 70): the loader adds the module whenever the walk routes a call.
 */
const mathImport = (
  out: string,
  outputs: string[],
  modules: ModuleUnit[],
  names: StringSet,
  json: boolean
): string => {
  if (names.size() === 0) {
    return ""
  }
  let k = 0
  for (const unit of modules) {
    if (k < outputs.length && isMathModule(unit.packageName, unit.name)) {
      const target = outputs[k]
      return `import ${braceList(names)} from "${relativeSpecifier(out, target)}"\n`
    }
    k = k + 1
  }
  noMathModule(json)
  return ""
}

/** Stop with an internal error (exit 70): a call was routed to `nish/math` and the loader did not add it. */
const noMathModule = (json: boolean): void => {
  process.exit(
    internalErrorFor("emit-ts: a call routed to nish/math, and no nish/math module was loaded", json)
  )
}

/**
 * The launcher: install the Node host, run `main`, exit with its code. An
 * entry written as top-level code (`src/script.ts`) runs as it is imported,
 * so importing it is the whole run, and a run that ends exits 0, as the
 * native `main` built around it does. A program with an `async` function
 * (`tasks`) awaits `main`, then every task `spawn` started and has not seen
 * finish, as the native driver drains its queue after `main` answers.
 */
const launcher = (entryOut: string, script: boolean, tasks: boolean): string => {
  const settle = tasks ? "await settleTasks()\n" : ""
  const sb = new StringBuilder()
  sb.add("// Written by `nish --emit-ts`: runs the program's `main` under Node.\n")
  sb.add(`import "${RUNTIME}/node"\n`)
  sb.add(`import { exit } from "${RUNTIME}"\n`)
  if (tasks) {
    sb.add(`import { settleTasks } from "${ASYNC_RUNTIME}"\n`)
  }
  if (script) {
    sb.add(`import "${relativeSpecifier(ENTRY_FILE, entryOut)}"\n`)
    sb.add("\n")
    sb.add(settle)
    sb.add("exit(0)\n")
    return sb.toText()
  }
  sb.add(`import { main } from "${relativeSpecifier(ENTRY_FILE, entryOut)}"\n`)
  sb.add("\n")
  sb.add(tasks ? "const code = await main()\n" : "const code = main()\n")
  sb.add(settle)
  sb.add('exit(typeof code === "number" ? code : 0)\n')
  return sb.toText()
}

/** Whether a function, method or arrow under `node` is declared `async`. */
const hasAsync = (node: Node): boolean => {
  if ((node.flags & FLAG_ASYNC) !== 0) {
    return true
  }
  for (const child of node.children) {
    if (hasAsync(child)) {
      return true
    }
  }
  return false
}

/**
 * The program written out as TypeScript: every root-package module, every
 * standard-library module it reaches, and `entry.ts`. A refusal is reported
 * through the compilation's sink, every one of them before it answers, so a
 * program refused twice says so twice.
 */
export const emitTypeScript = (compilation: Compilation): EmittedProgram => {
  const result = new EmittedProgram()
  const modules = compilation.modules
  const entry = compilation.entry()
  let base = dirname(normalizePath(entry.path))
  for (const unit of modules) {
    if (unit.packageName === ROOT_PACKAGE && !unit.source.host) {
      base = commonDirectory(base, dirname(normalizePath(unit.path)))
    }
  }
  // Without a working directory to resolve against, a module above the
  // directory of the others (`../shared/s.ts`) has no place inside the output
  // directory, and two modules that land on one path would overwrite each
  // other; both are refused rather than written somewhere else.
  const outputs: string[] = []
  let anyAsync = false
  for (const unit of modules) {
    const out = outputPathOf(unit, base)
    if (out === ".." || out.startsWith("../") || out.startsWith("/")) {
      result.unwritable = `--emit-ts cannot place ${unit.path}, which lies above the directory of the program's other modules`
      return result
    }
    if (out === ENTRY_FILE || out === STORAGE_FILE || (out.length > 0 && holds(outputs, out))) {
      result.unwritable = `--emit-ts would write ${unit.path} over another file at ${out}; rename or move the module`
      return result
    }
    outputs.push(out)
  }
  // WP50 §5.4: every module storage is a view of one buffer in STORAGE_FILE.
  const layouts = storageLayouts(compilation)
  let k = 0
  while (k < modules.length && k < outputs.length) {
    const unit = modules[k]
    const out = outputs[k]
    k = k + 1
    if (out.length === 0) {
      continue
    }
    const walk = new Walk(unit.checker.program, unit.checker.ctx.table, unit.source, unit.nodeCount)
    walk.warnStubs = unit.packageName === ROOT_PACKAGE
    walk.deterministic = unit.checker.ctx.deterministic
    let slot = 0
    while (slot < layouts.length) {
      const s = layouts[slot]
      if (s.module === k - 1) {
        walk.storageIds.push(s.newId)
        walk.storageSlots.push(slot)
      }
      slot = slot + 1
    }
    if (walk.storageIds.length > 0) {
      walk.storageImport = storageImport(out)
    }
    // WP49: an async function is written as the TypeScript it already is, and
    // the launcher awaits `main` and every spawned task. Read from the tree,
    // not `program.functions`, which holds no generic nothing instantiates.
    if (!anyAsync && hasAsync(unit.file)) {
      anyAsync = true
    }
    for (const stmt of unit.file.children) {
      if (stmt.kind !== N_IMPORT) {
        continue
      }
      if (stmt.text === NET_SPECIFIER) {
        walk.refuse(stmt, SIGNAL_REFUSAL)
        continue
      }
      if (stmt.text === REGION_SPECIFIER) {
        walk.refuse(stmt, REGION_REFUSAL)
        continue
      }
      // A second import of one specifier: its rewrite is already listed, and
      // listing it twice would edit each import twice.
      if (holds(walk.specifierFrom, stmt.text)) {
        continue
      }
      if (stmt.text === ASYNC_SPECIFIER) {
        walk.specifierFrom.push(stmt.text)
        walk.specifierTo.push(ASYNC_RUNTIME)
        continue
      }
      // `nish:secret` has source behind it, but it is answered by the runtime
      // like every other builtin module (`outputPathOf`).
      if (isBuiltinSpecifier(stmt.text) || stmt.text === SECRET_SPECIFIER) {
        walk.specifierFrom.push(stmt.text)
        walk.specifierTo.push(RUNTIME)
        continue
      }
      const target = unit.resolved.get(stmt.text, -1)
      const dest = target >= 0 && target < outputs.length ? outputs[target] : ""
      const hostPath =
        target >= 0 && target < modules.length && modules[target].source.host
          ? modules[target].source.path
          : ""
      if (hostPath.length > 0) {
        // The page's module (a module's path is never empty), named from
        // where this file is written.
        const at = compilation.workingDir
        walk.specifierFrom.push(stmt.text)
        walk.specifierTo.push(
          relativeSpecifier(
            resolvePath(at, joinPath([compilation.opts.emitTs, out])),
            resolvePath(at, hostPath)
          )
        )
      } else if (dest.length > 0) {
        walk.specifierFrom.push(stmt.text)
        walk.specifierTo.push(relativeSpecifier(out, dest))
      }
    }
    let edits: Edit[] = []
    emitModule(walk, unit.file, edits)
    if (walk.failure.length > 0) {
      result.internal = walk.failure
      return result
    }
    let r = 0
    while (r < walk.refusals.length) {
      const node = walk.refusedAt[r]
      compilation.sink.report(unit.source, node.start, node.end, walk.refusals[r])
      result.refused = true
      r = r + 1
    }
    if (result.refused) {
      continue
    }
    // A program's own generic written to throw is a portability warning
    // (NL8012), so the driver runs this before it prints those.
    r = 0
    while (r < walk.stubWarnings.length) {
      const node = walk.stubbedAt[r]
      compilation.sink.reportPortability(unit.source, node.start, node.end, walk.stubWarnings[r])
      r = r + 1
    }
    // A file with no import or export is a script to tsc, whose alias would be
    // global and meet the page's own `HostHandle`: `export {}` keeps it the file's.
    const scriptFile =
      walk.helpers.size() === 0 &&
      walk.widths.size() === 0 &&
      walk.mathNames.size() === 0 &&
      !isModule(unit.file)
    const header =
      runtimeImport("import", walk.helpers) +
      runtimeImport("import type", walk.widths) +
      mathImport(out, outputs, modules, walk.mathNames, compilation.opts.json) +
      (walk.hostHandle ? HOST_HANDLE_ALIAS : "") +
      (walk.hostHandle && scriptFile ? "export {}\n" : "") +
      (walk.usesStorage ? walk.storageImport : "")
    if (header.length > 0) {
      const at = importOffset(unit.source.text)
      // An import line is an edit like any other, so it goes in source order:
      // before every edit at or after the offset it is inserted at.
      const ordered: Edit[] = []
      let placed = false
      for (const edit of edits) {
        if (!placed && edit.start >= at) {
          ordered.push(new Edit(at, at, header))
          placed = true
        }
        ordered.push(edit)
      }
      if (!placed) {
        ordered.push(new Edit(at, at, header))
      }
      edits = ordered
    }
    const text = applyModuleEdits(walk, unit.source.text, edits)
    if (walk.failure.length > 0) {
      result.internal = walk.failure
      return result
    }
    result.files.push(new EmittedFile(out, text))
  }
  if (result.refused) {
    result.files = []
    return result
  }
  let entryOut = ""
  let script = false
  k = 0
  while (k < modules.length && k < outputs.length) {
    if (modules[k].isEntry) {
      entryOut = outputs[k]
      script = scriptMain(modules[k].file) !== null
    }
    k = k + 1
  }
  result.files.push(new EmittedFile(ENTRY_FILE, launcher(entryOut, script, anyAsync)))
  if (layouts.length > 0) {
    result.files.push(new EmittedFile(STORAGE_FILE, storageFileText(layouts)))
  }
  return result
}
