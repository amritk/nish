// `nish run`: where a script's binary is kept between runs, and how a run
// knows the binary it finds there is the one it would build.
//
// A run compiles every time — the front end is a few milliseconds, and it is
// the only thing that can tell an edited import or a changed `nish/` module
// from an unchanged one — and links only when the result is new. So the cache
// is keyed on what the link consumes rather than on the source files: the IR
// of every module, the link recipe, and the runtime the recipe compiles in.
// Nothing about the sources has to be tracked, and two scripts that compile to
// the same program share one binary.
//
// An entry is a directory named by the SHA-256 of the key, holding the binary
// and a `key` file that holds the key itself. The name is only where to look: a
// hit is the stored key being *equal* to this run's key, byte for byte, so even
// a collision would cost a relink and never run the wrong program; a
// cryptographic name means two programs never share an entry to begin with
// (docs/security/cli.md, CLI-8). The key file is written last, after the
// binary is in place, which is what makes its presence mean "the binary here is
// complete".
//
// The runtime cache beside it (`runtimeCacheRoot`, `runtimeCacheKey`) keeps
// the C runtime compiled once per recipe, for every `--link` and every run's
// link: an entry there holds the runtime's nine objects and a key, on the same
// terms. It is a cache of what a link reads, so this key does not mention it.

import { CLI, RUNTIME_HEADER, VERSION } from "./branding"
import { EmittedModule } from "./compilation"
import { dirname } from "./paths"
import { hexDigitLower, StringBuilder } from "./strings"

/**
 * The directory every entry lives under: `$XDG_CACHE_HOME/nish/run`, or
 * `$HOME/.cache/nish/run` when that is unset, empty or relative, as the XDG
 * base directory rules say. Empty when neither gives an absolute path, and the
 * caller refuses the run rather than falling back to `/tmp`: a directory other
 * users can write to is a directory someone else can put a binary in for this
 * one to execute.
 *
 * A relative value is ignored rather than resolved because it would resolve
 * against the working directory, and a run started in a checkout someone else
 * wrote would then look up its binary in a cache that checkout supplied
 * (docs/security/cli.md, CLI-3). An absolute root also means every path built
 * from it starts with `/`, so none of them can be read as an option by the
 * `mv` and `rm` the miss spawns.
 */
export const runCacheRoot = (): string => {
  const xdg = getenv("XDG_CACHE_HOME")
  if (xdg !== null && xdg.startsWith("/")) {
    return `${xdg}/${CLI}/run`
  }
  const home = getenv("HOME")
  if (home !== null && home.startsWith("/")) {
    return `${home}/.cache/${CLI}/run`
  }
  return ""
}

/**
 * Where `--link` and `nish run` keep the compiled runtime, `runCacheRoot`'s
 * sibling: `$XDG_CACHE_HOME/nish/runtime` or `$HOME/.cache/nish/runtime`, by
 * the same rules and for the same reasons. Empty when there is no absolute
 * root, and the link then compiles the runtime itself, as it always did.
 */
export const runtimeCacheRoot = (): string => {
  const runs = runCacheRoot()
  return runs.length === 0 ? "" : `${dirname(runs)}/runtime`
}

/**
 * The runtime's translation units, in the order `scripts/build.sh` compiles
 * and links them: `runtime.c` and the eight it pairs with it. One list for both
 * keys below and for the objects a runtime entry holds.
 */
export const runtimeUnits = (): string[] => [
  "runtime.c",
  "runtime-os.c",
  "runtime-parallel.c",
  "runtime-cross.c",
  "runtime-host.c",
  "runtime-net.c",
  "runtime-simd.c",
  "runtime-aes.c",
  "runtime-term.c",
]

/**
 * The files of `runtime/sqlite/` a link reads, sorted by bytes: every `.c`,
 * which `scripts/build.sh` compiles (`for unit in "$sqlite_dir"/*.c`), and
 * every `.h` they can include. Read from the directory rather than listed
 * here, so a file added beside the amalgamation is compiled, keyed and cached
 * with no second list to keep in step; a dotfile is skipped, as the script's
 * glob skips it. Empty when the directory cannot be read.
 */
const sqliteFiles = (root: string): string[] => {
  const files: string[] = []
  const names = readdirSync(`${root}/runtime/sqlite`)
  if (names !== null) {
    for (const name of names) {
      if (!name.startsWith(".") && (name.endsWith(".c") || name.endsWith(".h"))) {
        files.push(name)
      }
    }
  }
  return files
}

/**
 * The translation units of `runtime/sqlite/` (`sqliteFiles`, the `.c` ones),
 * which `scripts/build.sh` compiles and links only for a program whose IR
 * calls SQLite (`callsSqlite`): the objects a SQLite entry holds.
 */
export const sqliteUnits = (root: string): string[] => {
  const units: string[] = []
  for (const name of sqliteFiles(root)) {
    if (name.endsWith(".c")) {
      units.push(name)
    }
  }
  return units
}

/**
 * Whether a module declares a function of SQLite's (`sqlite3_`) or of its
 * adapter's (`nish_sqlite_`), so a link asks the cache for those objects
 * exactly when `scripts/build.sh` would link them. The rule is the script's
 * `grep -Eq '^declare [^"]*@(sqlite3|nish_sqlite)_'`, and the two move
 * together: a line that starts `declare ` and names either prefix after an `@`
 * that no `"` comes before. A mention in a string, a comment, a definition or
 * a quoted name does not count.
 */
const callsSqlite = (ir: string): boolean => {
  let at = ir.startsWith("declare ") ? 0 : ir.indexOf("\ndeclare ")
  while (at >= 0) {
    const next = ir.indexOf("\n", at + 1)
    const end = next < 0 ? ir.length : next
    const quote = ir.indexOf('"', at)
    const stop = quote >= 0 && quote < end ? quote : end
    let name = ir.indexOf("@", at)
    while (name >= 0 && name < stop) {
      if (ir.slice(name, name + 9) === "@sqlite3_" || ir.slice(name, name + 13) === "@nish_sqlite_") {
        return true
      }
      name = ir.indexOf("@", name + 1)
    }
    at = next < 0 ? -1 : ir.indexOf("\ndeclare ", next)
  }
  return false
}

/** Whether any of `modules` calls SQLite (`callsSqlite`). */
export const anyCallsSqlite = (modules: EmittedModule[]): boolean => {
  for (const module of modules) {
    if (callsSqlite(module.ir)) {
      return true
    }
  }
  return false
}

/**
 * The file an entry keeps the binary in: the script's own name, unless that
 * name is one the entry already uses for itself. A script called `key.ts` would
 * otherwise be linked to `<entry>/key`, and then overwritten by the key and
 * started as text (docs/security/cli.md, CLI-1). `.bin` makes the name differ
 * from `key` and from every scratch directory, which is `tmp-` and sixteen hex
 * digits with no dot; and since the key carries the name, one entry only ever
 * holds one script's binary, so no other script's name can meet the result.
 */
export const runBinaryName = (name: string): string =>
  name === "key" || name.startsWith("tmp-") ? `${name}.bin` : name

/**
 * The round constants K of FIPS 180-4 §4.2.2: the first 32 bits of the
 * fractional parts of the cube roots of the first sixty-four primes. A
 * function, because a module constant cannot be an array.
 */
const sha256Constants = (): u32[] => [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]

/** `x` rotated right by `n` bits, `0 < n < 32` (FIPS 180-4 §3.2, ROTR). */
const rotr = (x: u32, n: u32): u32 => (x >> n) | (x << (32 - n))

/**
 * Byte `j` of `text` once FIPS 180-4 §5.1.1 has padded it to `padded` bytes:
 * the text, then `0x80`, then zeros, then its length in bits as a big-endian
 * 64-bit number in the last eight bytes. Read one byte at a time so the padded
 * message is never built as a second copy of a key that can be megabytes.
 */
const paddedByte = (text: string, j: i32, padded: i32): u32 => {
  const n = text.length
  if (j < n) {
    return toU32(text.charCodeAt(j))
  }
  if (j === n) {
    return 0x80
  }
  const fromEnd = padded - 1 - j
  if (fromEnd >= 8) {
    return 0
  }
  const bits: u64 = toU64(n) * 8
  return toU32((bits >> toU64(fromEnd * 8)) & 255)
}

/**
 * SHA-256 (FIPS 180-4 §6.2) over the bytes of `text`, as sixty-four lowercase
 * hex digits: the name of a cache entry (docs/security/cli.md, CLI-8). Written
 * here rather than imported from `std/crypto/sha256`, because `src/` reads
 * nothing from the standard library. Every word is a `u32`, whose arithmetic
 * wraps in every mode, so the additions modulo 2^32 are plain `+`.
 */
export const sha256Hex = (text: string): string => {
  const k = sha256Constants()
  const h: u32[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const w = new Array<u32>(64)
  const n = text.length
  // The text, one byte of 0x80 and eight of length, rounded up to a block.
  const padded = (((n + 8) >> 6) + 1) << 6
  let block = 0
  while (block < padded) {
    let t = 0
    while (t < 16) {
      const at = block + t * 4
      let word: u32 = 0
      // Only `at + 4 <= n` matters; the rest is what the bounds proof needs to
      // drop the check on every `charCodeAt` here, `at` itself included.
      if (at >= 0 && at < text.length && at + 4 <= text.length) {
        word =
          (toU32(text.charCodeAt(at)) << 24) |
          (toU32(text.charCodeAt(at + 1)) << 16) |
          (toU32(text.charCodeAt(at + 2)) << 8) |
          toU32(text.charCodeAt(at + 3))
      } else {
        word =
          (paddedByte(text, at, padded) << 24) |
          (paddedByte(text, at + 1, padded) << 16) |
          (paddedByte(text, at + 2, padded) << 8) |
          paddedByte(text, at + 3, padded)
      }
      w[t] = word
      t = t + 1
    }
    while (t < 64) {
      const w15 = w[t - 15]
      const w2 = w[t - 2]
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >> 3)
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >> 10)
      w[t] = w[t - 16] + s0 + w[t - 7] + s1
      t = t + 1
    }
    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]
    t = 0
    // `k` has 64 entries; `t < k.length` is what proves `k[t]` in range.
    while (t < 64 && t < k.length) {
      const big1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const choose = (e & f) ^ (~e & g)
      const t1 = hh + big1 + choose + k[t] + w[t]
      const big0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const t2 = big0 + majority
      hh = g
      g = f
      f = e
      e = d + t1
      d = c
      c = b
      b = a
      a = t1 + t2
      t = t + 1
    }
    h[0] = h[0] + a
    h[1] = h[1] + b
    h[2] = h[2] + c
    h[3] = h[3] + d
    h[4] = h[4] + e
    h[5] = h[5] + f
    h[6] = h[6] + g
    h[7] = h[7] + hh
    block = block + 64
  }
  const out = new StringBuilder()
  for (const word of h) {
    let shift = 28
    while (shift >= 0) {
      out.add(hexDigitLower(toI32((word >> toU32(shift)) & 15)))
      shift = shift - 4
    }
  }
  return out.toText()
}

/**
 * The fingerprint of one file the link reads, or `-` when it cannot be read.
 * These are the package's own files and change only with the compiler, so a
 * hash of each stands in for its bytes; the IR, which changes with every edit,
 * is carried whole.
 */
const fileFingerprint = (path: string): string => {
  const text = readFileSyncOrNull(path)
  return text === null ? "-" : sha256Hex(text)
}

/**
 * One line per file of the package a link reads: `scripts/build.sh`, every
 * runtime unit and `nish.h`, the only header they include. Both keys carry
 * these lines, so a file added to the runtime is added to both at once.
 */
const addRecipeFingerprints = (key: StringBuilder, root: string): void => {
  key.add(`build.sh ${fileFingerprint(`${root}/scripts/build.sh`)}\n`)
  addUnitFingerprints(key, `${root}/runtime`, "", runtimeUnits(), 0)
  key.add(`${RUNTIME_HEADER} ${fileFingerprint(`${root}/runtime/${RUNTIME_HEADER}`)}\n`)
}

/**
 * The lines both keys of a SQLite link carry: one per file of
 * `runtime/sqlite/` (`sqliteFiles`), and the flags it appends to SQLite's
 * options (`NISH_SQLITE_CFLAGS`), which change the objects as much as an edit
 * to their source does. Computed once per link and handed to `runCacheKey`
 * and `sqliteCacheKey` both, because the amalgamation is megabytes to hash. A
 * program that does not call SQLite carries none of them, and keeps the key it
 * had before the directory existed.
 */
export const sqliteFingerprint = (root: string, sqliteFlags: string): string => {
  const key = new StringBuilder()
  addUnitFingerprints(key, `${root}/runtime`, "sqlite/", sqliteFiles(root), 0)
  key.add(`sqlite-cflags ${sqliteFlags.length}\n`)
  key.add(sqliteFlags)
  key.add("\n")
  return key.toText()
}

/**
 * The lines of `units` from `at` on, each the unit's path below `runtime/`:
 * `dir` is the directory of `runtime/` they are in, empty or ending in `/`.
 * Recursive rather than a loop, because a loop would keep every file it hashed
 * alive until the key is done (NL9011), and a call gives each file's text back
 * when it returns.
 */
const addUnitFingerprints = (
  key: StringBuilder,
  runtime: string,
  dir: string,
  units: string[],
  at: i32
): void => {
  if (at < 0 || at >= units.length) {
    return
  }
  const unit = `${dir}${units[at]}`
  key.add(`${unit} ${fileFingerprint(`${runtime}/${unit}`)}\n`)
  addUnitFingerprints(key, runtime, dir, units, at + 1)
}

/**
 * The recipe flags of every key: the profile, then `--cpu`, `-g` and
 * `--threads` each only when set, so a key for the baseline recipe is the
 * bytes it was before any of them existed.
 */
const profileLine = (profile: string, cpu: string, debugInfo: boolean, threads: boolean): string =>
  `profile ${profile}${cpu.length > 0 ? ` --cpu ${cpu}` : ""}${debugInfo ? " -g" : ""}${threads ? " --threads" : ""}\n`

/**
 * Everything a link's result depends on, as one text: a header line per
 * input to the recipe, then each module's name and IR. `name` is the file the
 * binary is kept in (`runBinaryName`), which is part of what a hit hands
 * back, so the key names everything the entry holds rather than relying on
 * the entry module's stem to imply it. `root` is the package
 * root `scripts/build.sh` and `runtime/` are read from; `cc` is the C compiler
 * the script will run (`CC`, or `clang`), since a different compiler is a
 * different binary. `cpu` is the `--cpu` level, empty for the baseline, which
 * the profile line names only when it is set, so a baseline key is the bytes
 * it was before the flag existed. `sqlite` is `sqliteFingerprint` when a module
 * calls SQLite (`anyCallsSqlite`), and empty when none does.
 */
export const runCacheKey = (
  modules: EmittedModule[],
  name: string,
  root: string,
  profile: string,
  cpu: string,
  debugInfo: boolean,
  threads: boolean,
  cc: string,
  sqlite: string
): string => {
  const key = new StringBuilder()
  key.add(`${CLI} ${VERSION}\n`)
  key.add(`run ${name}\n`)
  key.add(profileLine(profile, cpu, debugInfo, threads))
  key.add(`cc ${cc}\n`)
  addRecipeFingerprints(key, root)
  key.add(sqlite)
  for (const module of modules) {
    key.add(`module ${module.stem} ${module.ir.length}\n`)
    key.add(module.ir)
  }
  return key.toText()
}

/**
 * Everything the compiled runtime depends on, as one text, in `runCacheKey`'s
 * shape. `ccVersion` is what `cc --version` printed: speed and size keep LTO
 * bitcode, which only the LLVM that wrote it reads, and a compiler upgraded in
 * place keeps its name. It names the target too, so a cache shared between
 * machines never hands one another's objects. `runtimeDir` is the runtime's
 * real directory, which `-g` writes into the objects as where their source is.
 * The flags each profile compiles with are `scripts/build.sh`'s, whose bytes
 * are fingerprinted; it reads no variable but `CC` for the runtime's units. A
 * `--cpu` level is on the profile line, as in `runCacheKey`: objects compiled
 * for x86-64-v3 are never handed to a baseline link, nor the other way round.
 */
export const runtimeCacheKey = (
  root: string,
  runtimeDir: string,
  profile: string,
  cpu: string,
  debugInfo: boolean,
  threads: boolean,
  cc: string,
  ccVersion: string
): string => {
  const key = new StringBuilder()
  key.add(`${CLI} ${VERSION}\n`)
  key.add("runtime-objects\n")
  key.add(profileLine(profile, cpu, debugInfo, threads))
  key.add(`cc ${cc}\n`)
  key.add(`cc-version ${ccVersion.length}\n`)
  key.add(ccVersion)
  key.add(`runtime-dir ${runtimeDir}\n`)
  addRecipeFingerprints(key, root)
  return key.toText()
}

/**
 * Everything the compiled `runtime/sqlite/` depends on, as one text, in
 * `runtimeCacheKey`'s shape and for the same reasons; a SQLite entry is kept
 * apart from the runtime's because most programs never ask for one, and the
 * nine objects every link reads should not be compiled again when the
 * amalgamation changes. `sqliteDir` is the directory's real path, which `-g`
 * writes into the objects. `sqlite` is `sqliteFingerprint`, the same text
 * the run's own key carries.
 */
export const sqliteCacheKey = (
  root: string,
  sqliteDir: string,
  profile: string,
  cpu: string,
  debugInfo: boolean,
  threads: boolean,
  cc: string,
  ccVersion: string,
  sqlite: string
): string => {
  const key = new StringBuilder()
  key.add(`${CLI} ${VERSION}\n`)
  key.add("sqlite-objects\n")
  key.add(profileLine(profile, cpu, debugInfo, threads))
  key.add(`cc ${cc}\n`)
  key.add(`cc-version ${ccVersion.length}\n`)
  key.add(ccVersion)
  key.add(`sqlite-dir ${sqliteDir}\n`)
  key.add(`build.sh ${fileFingerprint(`${root}/scripts/build.sh`)}\n`)
  key.add(sqlite)
  return key.toText()
}
