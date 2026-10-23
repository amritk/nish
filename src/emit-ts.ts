// `--emit-ts <dir>` (wp33 §3): the checked program written back out as
// TypeScript that Node runs with its type stripping, one file per module.
//
// The root package's modules keep their paths relative to the directory they
// share; every standard-library module the program reaches is written under
// `nish/` beside them, so a `nish/x` import becomes a relative one and the
// output needs nothing installed but the runtime. A `nish:` builtin import
// becomes `nish/runtime`, the one package the output names. Last comes
// `entry.ts`, the launcher: it installs the Node host, calls `main` and exits
// with what it answered, which a module cannot do for itself because Nish's
// `main` is called, not run at load.
//
// What a module says is decided by the composer (`src/emit-ts-edits.ts`); this
// file decides where it goes, what its imports name, and whether it may be
// written at all. Two kinds of module are refused, with nothing written:
// one that declares C functions (NL4010), whose bodies are not in the program,
// and one that uses a builtin whose translation would reach past its own
// statement (NL4011).

import { CLI } from "./branding"
import { Compilation, ModuleUnit } from "./compilation"
import { Edit } from "./diagnostics"
import { applyModuleEdits, emitModule, SIGNAL_REFUSAL, Walk } from "./emit-ts-edits"
import { StringSet } from "./map"
import { isNishSpecifier } from "./nish-modules"
import { N_IMPORT } from "./nodes"
import { ROOT_PACKAGE } from "./packages"
import { dirname, normalizePath, relativePath } from "./paths"
import { StringBuilder } from "./strings"

/** The specifier every emitted module imports the runtime by. */
const RUNTIME: string = "nish/runtime"

/** The launcher's file name, which a root module may not also be written as. */
const ENTRY_FILE: string = "entry.ts"

/** The specifier the corpus refuses whole (NL4011). */
const NET_SPECIFIER: string = "nish:net"

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
 * program imports from where it is installed.
 */
const outputPathOf = (unit: ModuleUnit, base: string): string => {
  if (unit.packageName === ROOT_PACKAGE) {
    return relativePath(base, unit.path)
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

/**
 * The byte offset an import line goes at: after the comments that open the
 * module, so a module's header stays its first lines. A comment that ends
 * mid-line is not stepped past, so the import never splits a line.
 */
const importOffset = (text: string): i32 => {
  let at = 0
  let after = 0
  while (at >= 0 && at < text.length) {
    const c = text.charCodeAt(at)
    if (c === 32 || c === 9 || c === 10 || c === 13) {
      at = at + 1
    } else if (text.substring(at, at + 2) === "//") {
      const end = text.indexOf("\n", at)
      if (end < 0) {
        return text.length
      }
      at = end + 1
      after = at
    } else if (text.substring(at, at + 2) === "/*") {
      const close = text.indexOf("*/", at + 2)
      if (close < 0) {
        return after
      }
      const end = text.indexOf("\n", close + 2)
      if (end < 0) {
        return text.length
      }
      at = end + 1
      after = at
    } else {
      return after
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

/** The line a non-empty name list is imported from the runtime by, or the empty string. */
const runtimeImport = (keyword: string, names: StringSet): string =>
  names.size() === 0 ? "" : `${keyword} ${braceList(names)} from "${RUNTIME}"\n`

/** The launcher: install the Node host, run `main`, exit with its code. */
const launcher = (entryOut: string): string => {
  const sb = new StringBuilder()
  sb.add("// Written by `nish --emit-ts`: runs the program's `main` under Node.\n")
  sb.add(`import "${RUNTIME}/node"\n`)
  sb.add(`import { exit } from "${RUNTIME}"\n`)
  sb.add(`import { main } from "${relativeSpecifier(ENTRY_FILE, entryOut)}"\n`)
  sb.add("\n")
  sb.add("const code = main()\n")
  sb.add('exit(typeof code === "number" ? code : 0)\n')
  return sb.toText()
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
    if (unit.packageName === ROOT_PACKAGE) {
      base = commonDirectory(base, dirname(normalizePath(unit.path)))
    }
  }
  // Without a working directory to resolve against, a module above the
  // directory of the others (`../shared/s.ts`) has no place inside the output
  // directory, and two modules that land on one path would overwrite each
  // other; both are refused rather than written somewhere else.
  const outputs: string[] = []
  for (const unit of modules) {
    const out = outputPathOf(unit, base)
    if (out === ".." || out.startsWith("../") || out.startsWith("/")) {
      result.unwritable = `--emit-ts cannot place ${unit.path}, which lies above the directory of the program's other modules`
      return result
    }
    if (out === ENTRY_FILE || (out.length > 0 && holds(outputs, out))) {
      result.unwritable = `--emit-ts would write ${unit.path} over another file at ${out}; rename or move the module`
      return result
    }
    outputs.push(out)
  }
  let k = 0
  while (k < modules.length && k < outputs.length) {
    const unit = modules[k]
    const out = outputs[k]
    k = k + 1
    if (out.length === 0) {
      continue
    }
    const walk = new Walk(unit.checker.program, unit.source, unit.nodeCount)
    for (const stmt of unit.file.children) {
      if (stmt.kind !== N_IMPORT) {
        continue
      }
      if (stmt.text === NET_SPECIFIER) {
        walk.refuse(stmt, SIGNAL_REFUSAL)
        continue
      }
      // A second import of one specifier: its rewrite is already listed, and
      // listing it twice would edit each import twice.
      if (holds(walk.specifierFrom, stmt.text)) {
        continue
      }
      if (isNishSpecifier(stmt.text)) {
        walk.specifierFrom.push(stmt.text)
        walk.specifierTo.push(RUNTIME)
        continue
      }
      const target = unit.resolved.get(stmt.text, -1)
      const dest = target >= 0 && target < outputs.length ? outputs[target] : ""
      if (dest.length > 0) {
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
    const header = runtimeImport("import", walk.helpers) + runtimeImport("import type", walk.widths)
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
  k = 0
  while (k < modules.length && k < outputs.length) {
    if (modules[k].isEntry) {
      entryOut = outputs[k]
    }
    k = k + 1
  }
  result.files.push(new EmittedFile(ENTRY_FILE, launcher(entryOut)))
  return result
}
