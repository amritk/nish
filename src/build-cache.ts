// `nish run`'s module cache: the object each module compiles to, kept between
// runs so a rebuild compiles only the modules whose IR changed.
//
// A program that imports `nish/net/http1-server` is forty modules, and an edit
// to one line of its own changes the IR of that module alone; the other
// thirty-nine, the TLS and P-256 code among them, compiled to the same objects
// they did last time. An entry here is one module's object beside the key it
// was compiled for, on the run and runtime caches' terms (src/run-cache.ts):
// a directory named by the SHA-256 of the key, a hit only on a stored key
// equal to this one byte for byte, the key written last
// (docs/security/cli.md, CLI-12).
//
// Only the debug recipe uses it. There a module's object is native code and
// the link only places it, so a cached object and a fresh one link the same
// program. The speed and size recipes compile a module to LTO bitcode, which
// costs little next to the whole-program link that follows, and their binaries
// stay exactly what `scripts/build.sh` links without a cache.

import { CLI, VERSION } from "./branding"
import { dirname } from "./paths"
import { runCacheRoot, sha256Hex } from "./run-cache"
import { StringBuilder } from "./strings"

/**
 * `runCacheRoot`'s sibling, `$XDG_CACHE_HOME/nish/module` or
 * `$HOME/.cache/nish/module`, by the same rules and for the same reasons.
 * Empty when there is no absolute root, and the link then compiles every
 * module, as it always did.
 */
export const moduleCacheRoot = (): string => {
  const runs = runCacheRoot()
  return runs.length === 0 ? "" : `${dirname(runs)}/module`
}

/**
 * Everything one module's object depends on: the recipe, as the runtime
 * entry's key (`runtimeCacheKey`: the compiler's version, the profile and its
 * flags, `CC` and what `$CC --version` printed, `scripts/build.sh` and the
 * runtime's files), then the module's stem, which names its object, and the
 * SHA-256 of its IR. A digest, not the IR, so an entry holds one copy of the
 * module rather than two and a lookup reads back a few hundred bytes, on the
 * collision resistance the entry's name already rests on. The runtime's files
 * do not change a module's object, but a key that holds them is one already
 * computed for this link, and an edit there costs one recompile of each
 * module, not a wrong object.
 */
export const moduleCacheKey = (recipe: string, stem: string, ir: string): string => {
  const key = new StringBuilder()
  key.add(`${CLI} ${VERSION}\n`)
  key.add("module-object\n")
  key.add(`recipe ${recipe.length}\n`)
  key.add(recipe)
  key.add(`module ${stem}\n`)
  key.add(`ir ${ir.length} ${sha256Hex(ir)}\n`)
  return key.toText()
}
