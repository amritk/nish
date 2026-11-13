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
  "array, base64, bytes, cli, cli-args, cli-flags, collections, compress/checksum, compress/deflate, compress/gzip, compress/zlib, crypto/aes, crypto/base64url, crypto/bcrypt, crypto/bcrypt-batch, crypto/chacha20poly1305, crypto/ct, crypto/ed25519, crypto/hkdf, crypto/hmac, crypto/jwt, crypto/p256, crypto/p384, crypto/pki, crypto/pki-roots, crypto/rsa, crypto/sha1, crypto/sha256, crypto/sha512, crypto/x25519, crypto/x509, crypto/x509-random, host/game, host/ring, host/text, input, json, json-equal, json-format, json-number, json-pointer, json-tokenizer, json-typed, json-value, map, math, net/buffer-pool, net/dns, net/dns-config, net/dns-message, net/dns-resolver, net/fetch, net/handler, net/hpack, net/http-compress, net/http-fields, net/http1-client-codec, net/http1-codec, net/http1-server, net/http2, net/http2-cleartext, net/http2-frame, net/http2-tls, net/http3, net/http3-frame, net/http3-server, net/outbound, net/postgres, net/postgres-async, net/postgres-carrier, net/prefork, net/qpack, net/quic, net/quic-conn-ack, net/quic-conn-cid, net/quic-conn-params, net/quic-datagram, net/quic-frame, net/quic-listener, net/quic-packet, net/quic-recovery, net/quic-stream, net/router, net/serve, net/tls, net/tls-tcp, net/tls/client, net/tls/codec, net/tls/record, net/tls/record-client, net/tls/record-server, net/tls/schedule, net/tls/ticket, net/tls/verify, net/upstream, net/url, net/websocket, net/webtransport, pair, random, raster, regex, region, release, secret, sort, sqlite, sync/ring, sync/shm, synth, term, term-io, term-pixels, term-probe, term-rate, testing, text, threads, yaml, yaml-json, yaml-lines, yaml-write"

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
 * `nish/json-typed`: ordinary Nish but for `jsonDecode` and `jsonEncode`,
 * whose every call the compiler lowers in place to code it writes from the
 * class's fields (`src/json-typed.ts`, `src/emit-json.ts`). The module writes
 * a `.ll` of its own for everything else in it.
 */
const JSON_TYPED_SPECIFIER: string = "nish/json-typed"

/** Whether a module is the standard library's `std/json-typed.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isJsonTypedModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(JSON_TYPED_SPECIFIER)

/**
 * `std/secret.ts`, the source behind the builtin module `nish:secret`
 * (`src/nish-modules.ts`). It is in the library's directory so that it ships,
 * type-checks and is listed like every other module, but it is imported only
 * as `nish:secret`: `resolveSpecifier` refuses this spelling, so the rules of
 * `src/secret.ts` have one name to be read under.
 */
export const SECRET_STD_SPECIFIER: string = "nish/secret"

/**
 * `nish/text`: ordinary Nish but for one call, `indexOfAny`'s walk, which the
 * emitter replaces with the runtime kernel (`src/kernels.ts`).
 */
const TEXT_SPECIFIER: string = "nish/text"

/** Whether a module is the standard library's `std/text.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isTextModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(TEXT_SPECIFIER)

/**
 * `nish/bytes`: ordinary Nish but for five calls, the walks of `skipBlank`,
 * `skipDigits`, `skipJsonText`, `skipJsonPlain` and `copyBytes`, which the
 * emitter replaces with runtime kernels and a `memmove` (`src/kernels.ts`).
 */
const BYTES_SPECIFIER: string = "nish/bytes"

/** Whether a module is the standard library's `std/bytes.ts`: the package is part of the test, as for `isTextModule`. */
export const isBytesModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(BYTES_SPECIFIER)

/**
 * `nish/json`: ordinary Nish but for one call, the writer's f64 walk, which
 * the emitter replaces with a runtime kernel (`src/kernels.ts`).
 */
const JSON_SPECIFIER: string = "nish/json"

/** Whether a module is the standard library's `std/json.ts`: the package is part of the test, as for `isTextModule`. */
export const isJsonModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(JSON_SPECIFIER)

/**
 * `nish/crypto/aes`: ordinary Nish but for four calls, the seams the emitter
 * puts behind a branch to the runtime's AES kernels (`src/kernels.ts`).
 */
const CRYPTO_AES_SPECIFIER: string = "nish/crypto/aes"

/** Whether a module is the standard library's `std/crypto/aes.ts`: the package is part of the test, as for `isTextModule`. */
export const isCryptoAesModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(CRYPTO_AES_SPECIFIER)

/**
 * `nish/compress/checksum`: ordinary Nish but for one call, `Crc32.update`'s
 * walk, which the emitter puts behind a branch to the runtime's CRC-32 kernel
 * (`src/kernels.ts`).
 */
const COMPRESS_CHECKSUM_SPECIFIER: string = "nish/compress/checksum"

/** Whether a module is the standard library's `std/compress/checksum.ts`: the package is part of the test, as for `isTextModule`. */
export const isCompressChecksumModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(COMPRESS_CHECKSUM_SPECIFIER)

/**
 * `nish/regex`: ordinary Nish but for one call, the match-start scan's walk,
 * which the emitter replaces with the runtime kernel (`src/kernels.ts`).
 */
const REGEX_SPECIFIER: string = "nish/regex"

/** Whether a module is the standard library's `std/regex.ts`: the package is part of the test, as for `isTextModule`. */
export const isRegexModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(REGEX_SPECIFIER)

/**
 * `nish/math`: `Math.atan2`, `Math.tan` and `Math.hypot` on `f64`, in Nish
 * rather than libm, and on a page module or under `--deterministic` `sin`,
 * `cos`, `exp`, `log`, `pow` and the float `%` as well. Like
 * `nish/collections` a program never imports it: a call to one of them is
 * what loads it, and the functions it reaches are copied into the calling
 * module, so it writes no `.ll` of its own. Each is
 * exported as `<name>F64`: `tan`, `atan2` and `hypot` are the C library's names.
 */
export const MATH_SPECIFIER: string = "nish/math"

/** Whether a module is the standard library's `std/math.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isMathModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(MATH_SPECIFIER)

/**
 * `nish/sort`: the stable merge sort `xs.sort(cmp)` compiles to. Like
 * `nish/math` a program never imports it: a `.sort(...)` call is what loads
 * it (the checker's `importSort`), and the call is checked as one to its
 * `sortWith` template, instantiated per comparator.
 */
export const SORT_SPECIFIER: string = "nish/sort"

/** The local name `sortWith` is imported under: dotted, so no declaration can take it. */
export const SORT_LOCAL: string = "Array.prototype.sort"

/**
 * The local name a page module imports `nish/math`'s `fmodF64` under, for the
 * float `%` it lowers to (`importMath`, `CheckedProgram.floatRemainderOf`):
 * an operator, which no declaration can take.
 */
export const FLOAT_REM_LOCAL: string = "%"

/**
 * The local name `--deterministic` imports a `nish/math` function under for
 * the builtin it answers (`importMath`): `quietBitsF64` or `quietBitsF32` for
 * `f64ToBits` or `f32ToBits`, `numberExact` for `Number` and
 * `parseFloatExact` for `parseFloat`. The builtin's name with call
 * parentheses, which no declaration can take.
 */
export const routedBuiltinLocal = (builtin: string): string => `${builtin}()`

/** Whether `name` in `packageName` is `std/sort.ts`, which is copied into its user like `std/math.ts`. */
export const isSortModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(SORT_SPECIFIER)

/**
 * `nish/array`: the loops `xs.map(f)`, `xs.filter(f)`, `xs.some(f)`,
 * `xs.every(f)`, `xs.findIndex(f)` and `xs.slice(a, b)` compile to. Like
 * `nish/sort` a call of one of those methods is what loads it (the checker's
 * `importArrayMethods`), and the call is checked as one to its template,
 * instantiated per callback; a program may import the templates by name too.
 */
export const ARRAY_SPECIFIER: string = "nish/array"

/** Whether `name` is one of the array methods `nish/array` holds templates for. */
const isArrayMethod = (name: string): boolean =>
  name === "map" ||
  name === "filter" ||
  name === "some" ||
  name === "every" ||
  name === "findIndex" ||
  name === "slice"

/**
 * How many templates of `nish/array` a method `name` may become: a callback
 * method has one for a callback of one parameter and one, `<name>Indexed`, for
 * two; `slice` has one per argument count. 0 for any other name.
 */
export const arrayMethodTemplateCount = (name: string): i32 => {
  if (name === "slice") {
    return 3
  }
  return isArrayMethod(name) ? 2 : 0
}

/**
 * The `k`th template `arrayMethodTemplateCount` counts for `name`. Each answer
 * is a literal or `name` itself, so a loop over them allocates nothing.
 */
export const arrayMethodTemplate = (name: string, k: i32): string => {
  if (name === "slice") {
    if (k === 0) {
      return "sliceAll"
    }
    return k === 1 ? "sliceFrom" : "slice"
  }
  if (k === 0) {
    return name
  }
  if (name === "map") {
    return "mapIndexed"
  }
  if (name === "filter") {
    return "filterIndexed"
  }
  if (name === "some") {
    return "someIndexed"
  }
  return name === "every" ? "everyIndexed" : "findIndexIndexed"
}

/** The prefix of the local name a `nish/array` template is imported under. */
const ARRAY_LOCAL_PREFIX: string = "Array.prototype."

/** The local name a `nish/array` template is imported under: dotted, so no declaration can take it. */
export const arrayMethodLocal = (template: string): string => `${ARRAY_LOCAL_PREFIX}${template}`

/**
 * Whether an import under `local` is one the checker gave a module for an
 * array-method call (`importArrayMethods`), not one the program wrote: no
 * declaration can take a dotted name.
 */
export const isArrayMethodLocal = (local: string): boolean => local.startsWith(ARRAY_LOCAL_PREFIX)

/**
 * The array method a call of the std template imported under `local` was
 * written as (`sort` for `SORT_LOCAL`, `map` for `Array.prototype.mapIndexed`),
 * or `""` when `local` is no such name.
 */
export const rewrittenArrayMethod = (local: string): string =>
  local === SORT_LOCAL ? "sort" : arrayMethodOfLocal(local)

/** The suffix of a template for a callback of two parameters (`mapIndexed`). */
const INDEXED_SUFFIX: string = "Indexed"

/**
 * The array method a call of the template imported under `local` was written
 * as (`map` for `Array.prototype.mapIndexed`), or `""` when `local` names no
 * `nish/array` template.
 */
export const arrayMethodOfLocal = (local: string): string => {
  if (!isArrayMethodLocal(local)) {
    return ""
  }
  const template = local.substring(ARRAY_LOCAL_PREFIX.length)
  if (template === "sliceAll" || template === "sliceFrom" || template === "slice") {
    return "slice"
  }
  const method = template.endsWith(INDEXED_SUFFIX)
    ? template.substring(0, template.length - INDEXED_SUFFIX.length)
    : template
  return method !== "slice" && isArrayMethod(method) ? method : ""
}

/** Whether `name` in `packageName` is `std/array.ts`, which is copied into its user like `std/sort.ts`. */
export const isArrayModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(ARRAY_SPECIFIER)

/** Whether a module is `std/secret.ts`: the package is part of the test, as for `isCollectionsModule`. */
export const isSecretModule = (packageName: string, name: string): boolean =>
  packageName === CLI && name === stdModuleName(SECRET_STD_SPECIFIER)
