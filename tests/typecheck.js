/**
 * `tsc --noEmit`, run inside the harness rather than spawned once per check.
 *
 * **What a spawn cost, and where it went.** Each `node tsc` paid Node's start-up,
 * the load of `typescript` itself, a parse and bind of every default lib and
 * `@types` package, and then a full check of those libraries, because nothing
 * here sets `skipLibCheck`. For a generated `.d.ts` of thirty lines the file was
 * the smallest part: about 2.4 s a spawn, and eight of them in a row were 19 s of
 * CI's critical path. In this process the load happens once, and
 * {@link typeCheckDeclarations} checks the libraries once for every file.
 *
 * **The answer has to be the one the spawn gave.** So the options are the CLI's
 * own (`ts.parseCommandLine` for the flags, `getParsedCommandLineOfConfigFile`
 * for `-p`), the host is `ts.createCompilerHost` with its working directory
 * pinned to the one the spawn had (the directory that `@types` is found from
 * when no config names one), and a result is `ok` exactly when tsc would have
 * exited 0: when it reported no diagnostic at all. The text is
 * `ts.formatDiagnostics`, which is what the CLI prints when stdout is not a
 * terminal, so a failure reads the way a spawned one did.
 */
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const require = createRequire(import.meta.url)

// Loaded on first use, not on import: a filtered run that reaches no check here
// does not pay for the compiler.
const typescript = () => require("typescript")

/** A compiler host that reads through `ts.sys` and sees `cwd` as its working directory. */
const hostFor = (ts, options, cwd) => {
  const host = ts.createCompilerHost(options)
  host.getCurrentDirectory = () => cwd
  return host
}

/** The diagnostics `tsc` would print for one program, deduplicated and in its order. */
const diagnosticsOf = (ts, rootNames, options, host, configErrors) => {
  const program = ts.createProgram({ rootNames, options, host, configFileParsingDiagnostics: configErrors })
  // `getPreEmitDiagnostics` asks for the semantic diagnostics even when the
  // syntactic ones are not empty, where the CLI stops. That can add lines to a
  // failure, never turn one into a pass or a pass into a failure.
  return ts.sortAndDeduplicateDiagnostics(ts.getPreEmitDiagnostics(program))
}

const resultOf = (ts, diagnostics, host) => ({
  ok: diagnostics.length === 0,
  output: ts.formatDiagnostics(diagnostics, host),
})

/**
 * `tsc -p <config>`, with `cwd` as the spawn's working directory.
 *
 * Every call is a program of its own, exactly as every spawn was: two projects
 * that share a file still get a checker each, so one project's files cannot
 * decide another's answer.
 */
export const typeCheckProject = (config, cwd) => {
  const ts = typescript()
  const unrecoverable = []
  const parsed = ts.getParsedCommandLineOfConfigFile(
    config,
    {},
    {
      ...ts.sys,
      getCurrentDirectory: () => cwd,
      onUnRecoverableConfigFileDiagnostic: (d) => unrecoverable.push(d),
    }
  )
  const host = hostFor(ts, parsed === undefined ? {} : parsed.options, cwd)
  if (parsed === undefined) {
    return resultOf(ts, unrecoverable, host)
  }
  const configErrors = ts.getConfigFileParsingDiagnostics(parsed)
  return resultOf(ts, diagnosticsOf(ts, parsed.fileNames, parsed.options, host, configErrors), host)
}

/**
 * Whether a declaration file's answer from tsc can depend on nothing but its own
 * text and the global scope every program here starts with.
 *
 * That is what lets several of them share one program. A module's own
 * declarations are invisible outside it, so two such files cannot collide or
 * merge; the ways a file reaches past that are all syntax, and every one of them
 * sends it to a program of its own:
 *
 * - not being a module at all (a script's declarations are global);
 * - `declare global`, `declare module "x"` and `export as namespace`, which add
 *   to a scope other files see;
 * - an import of any spelling, which puts a second file in its program;
 * - a triple-slash `path`, `types` or `lib` reference, or `no-default-lib`,
 *   each of which changes the file set or the libraries for the whole program.
 *
 * Any doubt answers `false`, which costs a second lib check and nothing else.
 */
export const standsAlone = (fileName, text) => {
  const ts = typescript()
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
  if (
    !ts.isExternalModule(sf) ||
    sf.hasNoDefaultLib ||
    sf.referencedFiles.length > 0 ||
    sf.typeReferenceDirectives.length > 0 ||
    sf.libReferenceDirectives.length > 0
  ) {
    return false
  }
  let reaches = false
  const visit = (node) => {
    if (
      ts.isModuleDeclaration(node) ||
      ts.isNamespaceExportDeclaration(node) ||
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportTypeNode(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      reaches = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return !reaches
}

/**
 * `tsc --noEmit --strict <file>` for each of `files`, one answer per file, in
 * one process and, where {@link standsAlone} allows it, one program.
 *
 * In the shared program a diagnostic is the file's it is reported in. One that
 * has no file, or is in a library, is every file's: each spawn would have
 * printed it and failed. A file that does not stand alone is checked in a
 * program of its own, which is the spawn's answer by construction.
 *
 * Returns a `Map` from each path in `files` to `{ ok, output }`.
 */
export const typeCheckDeclarations = (files, cwd) => {
  const ts = typescript()
  const { options } = ts.parseCommandLine(["--noEmit", "--strict"])
  const host = hostFor(ts, options, cwd)
  const results = new Map()
  const together = []
  for (const file of files) {
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null
    if (text !== null && standsAlone(file, text)) {
      together.push(file)
    } else {
      results.set(file, resultOf(ts, diagnosticsOf(ts, [file], options, host, []), host))
    }
  }
  if (together.length > 0) {
    const byFile = new Map(together.map((f) => [path.resolve(cwd, f), []]))
    const shared = []
    for (const d of diagnosticsOf(ts, together, options, host, [])) {
      const own = d.file === undefined ? undefined : byFile.get(path.resolve(cwd, d.file.fileName))
      if (own === undefined) {
        shared.push(d)
      } else {
        own.push(d)
      }
    }
    for (const file of together) {
      const own = byFile.get(path.resolve(cwd, file))
      results.set(file, resultOf(ts, ts.sortAndDeduplicateDiagnostics([...shared, ...own]), host))
    }
  }
  return results
}
