/**
 * A load hook that runs a `.ts` module as TypeScript transforms it, enums and
 * all: `node --import ./tests/ts-transform.js page.mjs`.
 *
 * Node strips types on its own, but a host module the wasm tests load declares
 * an `enum`, which stripping refuses, and Node 26 removed
 * `--experimental-transform-types`. This hook hands every `.ts` source to
 * TypeScript's `transpileModule` instead, so the page runs the same on every
 * Node the CI matrix pins.
 */
import { registerHooks } from "node:module"
import ts from "typescript"

registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith("file:") || !url.endsWith(".ts")) {
      return nextLoad(url, context)
    }
    const loaded = nextLoad(url, { ...context, format: "module" })
    const source =
      typeof loaded.source === "string" ? loaded.source : Buffer.from(loaded.source).toString("utf8")
    const { outputText } = ts.transpileModule(source, {
      fileName: new URL(url).pathname,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
    })
    return { format: "module", source: outputText, shortCircuit: true }
  },
})
