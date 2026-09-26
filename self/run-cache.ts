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
// An entry is a directory named by a 64-bit FNV-1a of the key, holding the
// binary and a `key` file that holds the key itself. The name is only where to
// look: a hit is the stored key being *equal* to this run's key, byte for byte,
// so a hash collision costs a relink and never runs the wrong program. The key
// file is written last, after the binary is in place, which is what makes its
// presence mean "the binary here is complete".

import { CLI, RUNTIME_HEADER, VERSION } from "./branding";
import { EmittedModule } from "./compilation";
import { hexDigitLower, StringBuilder } from "./strings";

/**
 * The directory every entry lives under: `$XDG_CACHE_HOME/nish/run`, or
 * `$HOME/.cache/nish/run` when that is unset or empty, as the XDG base
 * directory rules say. Empty when neither is set, and the caller refuses the
 * run rather than falling back to `/tmp`: a directory other users can write to
 * is a directory someone else can put a binary in for this one to execute.
 */
export const runCacheRoot = (): string => {
  const xdg = getenv("XDG_CACHE_HOME");
  if (xdg !== null && xdg.length > 0) {
    return `${xdg}/${CLI}/run`;
  }
  const home = getenv("HOME");
  if (home !== null && home.length > 0) {
    return `${home}/.cache/${CLI}/run`;
  }
  return "";
};

/**
 * FNV-1a, 64-bit, over the bytes of `text`, as sixteen lowercase hex digits.
 * The round overflows on purpose, so it is done in `u64`, whose arithmetic
 * wraps whatever `--wrapping` says. The offset basis is past 2^53 and cannot
 * be written as a literal (docs/LANGUAGE.md, "Unsigned integers"), so it is
 * built from its two halves. FNV and its constants are public domain.
 */
export const fnv1a64Hex = (text: string): string => {
  const high: u64 = 0xcbf29ce4;
  const low: u64 = 0x84222325;
  const prime: u64 = 1099511628211;
  const thirtyTwo: u64 = 32;
  let hash: u64 = (high << thirtyTwo) | low;
  const n = text.length;
  let i = 0;
  while (i < n) {
    hash = hash ^ toU64(text.charCodeAt(i));
    hash = hash * prime;
    i = i + 1;
  }
  const out = new StringBuilder();
  let shift = 60;
  while (shift >= 0) {
    out.add(hexDigitLower(toI32((hash >> toU64(shift)) & toU64(15))));
    shift = shift - 4;
  }
  return out.toText();
};

/**
 * The fingerprint of one file the link reads, or `-` when it cannot be read.
 * These are the package's own files and change only with the compiler, so a
 * hash of each stands in for its bytes; the IR, which changes with every edit,
 * is carried whole.
 */
const fileFingerprint = (path: string): string => {
  const text = readFileSyncOrNull(path);
  return text === null ? "-" : fnv1a64Hex(text);
};

/**
 * Everything a link's result depends on, as one text: a header line per
 * input to the recipe, then each module's name and IR. `root` is the package
 * root `scripts/build.sh` and `runtime/` are read from; `cc` is the C compiler
 * the script will run (`CC`, or `clang`), since a different compiler is a
 * different binary.
 */
export const runCacheKey = (
  modules: EmittedModule[],
  root: string,
  profile: string,
  debugInfo: boolean,
  threads: boolean,
  cc: string
): string => {
  const key = new StringBuilder();
  key.add(`${CLI} ${VERSION}\n`);
  key.add(`profile ${profile}${debugInfo ? " -g" : ""}${threads ? " --threads" : ""}\n`);
  key.add(`cc ${cc}\n`);
  key.add(`build.sh ${fileFingerprint(`${root}/scripts/build.sh`)}\n`);
  key.add(`runtime.c ${fileFingerprint(`${root}/runtime/runtime.c`)}\n`);
  key.add(`runtime_os.c ${fileFingerprint(`${root}/runtime/runtime_os.c`)}\n`);
  key.add(`runtime_parallel.c ${fileFingerprint(`${root}/runtime/runtime_parallel.c`)}\n`);
  key.add(`${RUNTIME_HEADER} ${fileFingerprint(`${root}/runtime/${RUNTIME_HEADER}`)}\n`);
  for (const module of modules) {
    key.add(`module ${module.stem} ${module.ir.length}\n`);
    key.add(module.ir);
  }
  return key.toText();
};
