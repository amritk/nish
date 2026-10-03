// The standard library, as the resolver sees it: where it lives and what is in
// it (stage0's `src/std-modules.ts` is the stage0 twin).
//
// This is the counterpart of `nish-modules.ts`, and the contrast is the point.
// A `nish:` module is a builtin — no file, no code, nothing linked. A `nish/`
// module is ordinary Nish source that ships beside the compiler and is compiled
// into whatever imports it, so all this module answers is a path and a listing;
// everything after that is the ordinary module path.

import { CLI, STD_PREFIX } from "./branding"
import { normalizePath } from "./paths"
import { splitByte } from "./strings"

const SLASH: i32 = 47
const DOT: i32 = 46

/** The directory the library lives in, relative to the package root. */
const STD_DIR: string = "std"

/**
 * `nish/text` -> `std/text.ts`: the name a standard-library module carries in
 * its IR header, its `DIFile` and its diagnostics (stage0's `src/std-modules.ts` answers
 * the same string).
 *
 * Package-relative and nothing else, which is the half of a module's identity
 * that `packageRoot()` must not reach. The path below is where the file *is*,
 * and it is `<dir of argv[0]>/../std/text.ts`, so it says as much about how the
 * compiler was invoked as about the program: `./build/nish` and
 * `/abs/build/nish` name one module two ways, and the harness happened to use
 * the spelling that agreed with stage0 (WP19 §A7's third bullet). The name is
 * what goes in the IR, so the name is the one that may not depend on it.
 */
export const stdModuleName = (specifier: string): string =>
  `${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`

/**
 * `nish/text` -> `<package root>/std/text.ts`, normalised: the file to open.
 *
 * The normalisation keeps the *identity* tidy — `packageRoot()` answers
 * `<dir of argv[0]>/..`, so without it the path would be
 * `./build/../std/text.ts` — and it is no longer what keeps the two compilers'
 * headers equal, because the header is `stdModuleName` now.
 */
export const stdModulePath = (root: string, specifier: string): string =>
  normalizePath(`${root}/${STD_DIR}/${specifier.substring(STD_PREFIX.length)}.ts`)

/**
 * Whether a module named `name` at `path` is a standard-library module: the
 * pair the two functions above answer for one specifier, under the library
 * root `root`. Asked by where the module was resolved rather than by its
 * package name, because a dependency may itself be called `nish`
 * (WP35, `src/capability-report.ts`).
 */
export const isStdModule = (root: string, name: string, path: string): boolean =>
  name.startsWith(`${STD_DIR}/`) && path === normalizePath(`${root}/${name}`)

/**
 * Whether `nish/<name>` names a module *inside* the library
 * (`isStdModuleName` in stage0's `src/std-modules.ts` is the same rule).
 *
 * `parseBareSpecifier`'s rule, one package along: no segment may be empty or
 * begin with a `.`, which rules out a `..` climbing out of the package and a
 * `//` that joins to nothing. It is what makes the name above package-relative
 * as a property rather than as a description of the specifiers people happen to
 * write — `nish/../../escape/lib` would be named from wherever the compiler is
 * installed, and every install would spell it differently.
 *
 * The empty name is left to the caller: `nish/` is answered by the sentence
 * that lists the library, which is the more useful of the two.
 */
export const isStdModuleName = (name: string): boolean => {
  for (const segment of splitByte(name, SLASH)) {
    if (segment.length === 0 || segment.charCodeAt(0) === DOT) {
      return false
    }
  }
  return true
}

/**
 * The modules the library has, for the diagnostic that lists them, sorted and
 * each by what follows `nish/` (`std/crypto/sha256.ts` is `crypto/sha256`).
 * A literal, not a directory read: `src/` has to compile under the *last
 * released* compiler (the WP19 G2 gate `scripts/bootstrap.sh --verify` runs),
 * so it may only use builtins that release had, and `readdirSync` is newer.
 * `tests/run.js` walks `std/` at every depth and fails when the two disagree,
 * which is the same arrangement that keeps `VERSION` in `branding.ts` honest
 * against `package.json`.
 */
export const stdModuleNames = (): string =>
  "collections, crypto/aes, crypto/base64url, crypto/chacha20poly1305, crypto/ct, crypto/hkdf, crypto/hmac, crypto/p256, crypto/sha256, crypto/sha512, crypto/x25519, crypto/x509, json, map, net/quic-packet, net/tls, net/tls/codec, net/tls/schedule, pair, secret, testing, text, threads"

/**
 * `nish/collections`: the module the global `Map` and `Set` are declared in
 * (docs/wp32-map.md §4). A program never has to import it — naming `Map` or
 * `Set` is what loads it — and it writes no `.ll` of its own: every instance a
 * module uses is emitted into that module.
 */
export const COLLECTIONS_SPECIFIER: string = "nish/collections"

/**
 * Whether a module is the standard library's `std/collections.ts`. The
 * package is part of the test, as it is for `nish/threads`: a root-package
 * file that happens to sit at `std/collections.ts` is an ordinary module, so
 * the compiler that tests the library by compiling it directly compiles it as
 * written.
 */
export const isCollectionsModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(COLLECTIONS_SPECIFIER)

/**
 * `nish/map`: `reserve` and `getOrInsert` (docs/wp32-map.md §9.2). Their
 * bodies are what runs under Node; natively every call is lowered in place,
 * to the table's `reserveSlots` and to one `probe` and a write through its
 * answer, so like `nish/collections` it writes no `.ll` of its own.
 */
const MAP_EXTRAS_SPECIFIER: string = "nish/map"

/** Whether a module is the standard library's `std/map.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isMapExtrasModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(MAP_EXTRAS_SPECIFIER)

/**
 * `std/secret.ts`, the source behind the builtin module `nish:secret`
 * (`src/nish-modules.ts`). It is in the library's directory so that it ships,
 * type-checks and is listed like every other module, but it is imported only
 * as `nish:secret`: `resolveSpecifier` refuses this spelling, so the rules of
 * `src/secret.ts` have one name to be read under.
 */
export const SECRET_STD_SPECIFIER: string = "nish/secret"

/** Whether a module is `std/secret.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isSecretModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(SECRET_STD_SPECIFIER)
