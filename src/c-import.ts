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
import { CJ_ARRAY, CJ_BOOLEAN, CJ_NUMBER, CJ_OBJECT, CJ_STRING, CJson } from "./c-import-json"
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

/** The words Nish's parser refuses as a field name (checked against the compiler). */
const isFieldReserved = (name: string): boolean =>
  name === "if" ||
  name === "do" ||
  name === "new" ||
  name === "let" ||
  name === "for" ||
  name === "else" ||
  name === "case" ||
  name === "this" ||
  name === "null" ||
  name === "true" ||
  name === "while" ||
  name === "break" ||
  name === "false" ||
  name === "class" ||
  name === "const" ||
  name === "super" ||
  name === "throw" ||
  name === "return" ||
  name === "export" ||
  name === "import" ||
  name === "switch" ||
  name === "default" ||
  name === "extends" ||
  name === "function" ||
  name === "continue" ||
  name === "debugger" ||
  name === "undefined" ||
  name === "interface" ||
  name === "prototype" ||
  name === "implements"

/** The names a function, constant or parameter may not have. */
const isNameReserved = (name: string): boolean =>
  isCReservedWord(name) ||
  isFieldReserved(name) ||
  name === "var" ||
  name === "catch" ||
  name === "eval" ||
  name === "Symbol" ||
  name === "arguments"

/** The out classes a module may declare, whose names nothing else may take. */
const isOutName = (name: string): boolean =>
  name === "OutPtr" ||
  name === "OutI32" ||
  name === "OutU32" ||
  name === "OutI64" ||
  name === "OutU64" ||
  name === "OutU8" ||
  name === "OutU16" ||
  name === "OutF32" ||
  name === "OutF64"

/** The names a `declare class` may not have: reserved words and Nish's own types. */
const isClassReserved = (name: string): boolean =>
  isNameReserved(name) ||
  isOutName(name) ||
  name === "any" ||
  name === "unknown" ||
  name === "never" ||
  name === "object" ||
  name === "symbol" ||
  name === "bigint" ||
  name === "readonly" ||
  name === "i8" ||
  name === "i16" ||
  name === "i32" ||
  name === "i64" ||
  name === "u8" ||
  name === "u16" ||
  name === "u32" ||
  name === "u64" ||
  name === "f32" ||
  name === "f64" ||
  name === "isize" ||
  name === "usize" ||
  name === "CPtr" ||
  name === "Array" ||
  name === "Map" ||
  name === "Set" ||
  name === "Promise" ||
  name === "Error" ||
  name === "Record" ||
  name === "integer" ||
  name === "CountedBy"

/** A C parameter name as a Nish identifier: a reserved word gets a trailing `_`. */
const nishName = (name: string): string => (isNameReserved(name) ? `${name}_` : name)

/**
 * `path` as one shell word for the `Regenerate:` line: as it is when every
 * character is one a shell leaves alone, else in single quotes (a path with a
 * quote never gets here: `unsafePath` refuses it).
 */
const shellWord = (path: string): string => {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    const plain =
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c === 43 ||
      c === 44 ||
      c === 45 ||
      c === 46 ||
      c === 47 ||
      c === 58 ||
      c === 61 ||
      c === 64 ||
      c === 95
    if (!plain) {
      return `'${path}'`
    }
  }
  return path.length > 0 ? path : "''"
}

/** Sorts `report` by `lines`, keeping the order of entries on one line (an insertion sort). */
const sortReport = (report: string[], lines: i32[]): void => {
  for (let i = 1; i < report.length && i < lines.length; i++) {
    const entry = report[i]
    const line = lines[i]
    let j = i - 1
    while (j >= 0 && j < lines.length && j < report.length && lines[j] > line) {
      const k = j + 1
      if (k < lines.length && k < report.length) {
        report[k] = report[j]
        lines[k] = lines[j]
      }
      j--
    }
    const k = j + 1
    if (k >= 0 && k < lines.length && k < report.length) {
      report[k] = entry
      lines[k] = line
    }
  }
}

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

/** Where `sub` last starts in `s`, or -1. */
const lastIndexOf = (s: string, sub: string): i32 => {
  let last = -1
  let at = s.indexOf(sub, 0)
  while (at >= 0) {
    last = at
    at = s.indexOf(sub, at + 1)
  }
  return last
}

/** The most of a header a doc comment may span, a cap on the text one is read from. */
const DOC_MAX: i32 = 65536

/** A blank, newline or `*`: what lies between a doc comment's opening and its first word. */
function isDocMargin(c: i32): boolean {
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 42
}

/**
 * The text of the doc comment (`/**` to its close) `s` starts with, one line per line of
 * the comment with its margin (spaces, a leading `*` and the space after it)
 * removed, joined by `\n`; empty when `s` does not start with one, when it is
 * a trailing `/**<` comment, or when any line is not one the module's own
 * comment could hold. A header's doc comment lands on its binding whole or
 * not at all, so no line of it is dropped or rewritten.
 */
const docText = (s: string): string => {
  if (!s.startsWith("/**") || s.startsWith("/**<") || s.startsWith("/**/")) {
    return ""
  }
  const end = s.indexOf("*/", 3)
  if (end < 0) {
    return ""
  }
  const raw = splitByte(s.slice(3, end), 10)
  const lines: string[] = []
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i]
    if (line.endsWith("\r")) {
      line = line.slice(0, line.length - 1)
    }
    line = trimSpaces(line)
    if (line.startsWith("*")) {
      line = line.slice(1)
      line = line.startsWith(" ") ? line.slice(1) : line
      line = trimSpaces(line)
    }
    lines.push(line)
  }
  let first = 0
  let last = lines.length
  while (first < last && lines[first].length === 0) {
    first++
  }
  while (last > first && lines[last - 1].length === 0) {
    last--
  }
  if (first === last) {
    return ""
  }
  const kept = lines.slice(first, last)
  for (let i = 0; i < kept.length; i++) {
    if (!emittable(kept[i], AS_COMMENT)) {
      return ""
    }
  }
  return kept.join("\n")
}

/** Whether `c` may continue a C identifier. */
const isIdentByte = (c: i32): boolean =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95

/** An emitted word that is an ASCII C identifier. */
const AS_IDENT: i32 = 1
/** An emitted word that is a decimal integer. */
const AS_INTEGER: i32 = 2
/** An emitted word that is a string literal of printable ASCII. */
const AS_STRING: i32 = 3
/** An emitted line inside the module's closing comment. */
const AS_COMMENT: i32 = 4

/** Whether `c` is printable ASCII, a space through `~`. */
const isPrintable = (c: i32): boolean => c >= 32 && c <= 126

/**
 * The one check every piece of text the module copies from the header, the
 * overrides or the command line passes before it is written: an ASCII C
 * identifier (no `$`, no byte above 127), a decimal integer, a string
 * literal of printable ASCII holding no `"` or `\`, or a comment line of
 * printable ASCII holding neither comment delimiter. Nothing else reaches
 * the module, so no header can put a bidi control, a line break or a
 * comment's end into it.
 */
const emittable = (s: string, as: i32): boolean => {
  if (as === AS_IDENT) {
    if (s.length === 0 || (s.charCodeAt(0) >= 48 && s.charCodeAt(0) <= 57)) {
      return false
    }
    for (let i = 0; i < s.length; i++) {
      if (!isIdentByte(s.charCodeAt(i))) {
        return false
      }
    }
    return true
  }
  if (as === AS_INTEGER) {
    const signed = s.length > 1 && s.charCodeAt(0) === 45
    if (s.length === 0) {
      return false
    }
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      if ((c < 48 || c > 57) && !(i === 0 && signed)) {
        return false
      }
    }
    return true
  }
  if (as === AS_STRING) {
    if (s.length < 2 || s.charCodeAt(0) !== 34 || s.charCodeAt(s.length - 1) !== 34) {
      return false
    }
    for (let i = 1; i < s.length - 1; i++) {
      const c = s.charCodeAt(i)
      if (!isPrintable(c) || c === 34 || c === 92) {
        return false
      }
    }
    return true
  }
  if (as === AS_COMMENT) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      if (!isPrintable(c)) {
        return false
      }
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0
      if ((c === 42 && next === 47) || (c === 47 && next === 42)) {
        return false
      }
    }
    return true
  }
  return false
}

/** Whether `s` is an ASCII C identifier, the only name the module copies. */
const isIdent = (s: string): boolean => emittable(s, AS_IDENT)

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

/** The digits `s[from, to)` read as a number, negated, which holds -2^63. */
const negatedDigits = (s: string, from: i32, to: i32): i64 => {
  let value: i64 = 0
  for (let i = from; i >= 0 && i < to && i < s.length; i++) {
    value = value * 10 - toI64(s.charCodeAt(i) - 48)
  }
  return value
}

/** Whether the digits `s[from, to)` are no greater than `limit`'s, both without leading zeros. */
const digitsAtMost = (s: string, from: i32, to: i32, limit: string): boolean => {
  if (to - from !== limit.length) {
    return to - from < limit.length
  }
  for (let i = 0; i < limit.length; i++) {
    const c = s.charCodeAt(from + i)
    const l = limit.charCodeAt(i)
    if (c !== l) {
      return c < l
    }
  }
  return true
}

/**
 * A decimal integer clang printed, with an optional sign. A value past an
 * i64's range, which clang prints for an unsigned 64-bit one above 2^63,
 * reads as -2^63: below zero, as a two's-complement read of it would be.
 */
const parseI64 = (s: string): i64 => {
  let negative = false
  let i = 0
  if (s.length > 0 && s.charCodeAt(0) === 45) {
    negative = true
    i = 1
  }
  let end = i
  while (end < s.length && s.charCodeAt(end) >= 48 && s.charCodeAt(end) <= 57) {
    end++
  }
  const min = "9223372036854775808"
  if (!digitsAtMost(s, i, end, negative ? min : "9223372036854775807")) {
    return negatedDigits(min, 0, min.length)
  }
  const value = negatedDigits(s, i, end)
  return negative ? value : -value
}

/** Whether `name` matches `glob`, where `*` is any run of bytes and `?` is one. */
const globMatches = (glob: string, name: string): boolean => {
  let g = 0
  let n = 0
  let star = -1
  let mark = 0
  while (n < name.length) {
    const gc = g >= 0 && g < glob.length ? glob.charCodeAt(g) : -1
    const nc = n >= 0 ? name.charCodeAt(n) : -1
    if (gc === 63 || (gc >= 0 && gc !== 42 && gc === nc)) {
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
  while (g >= 0 && g < glob.length && glob.charCodeAt(g) === 42) {
    g++
  }
  return g === glob.length
}

/**
 * Whether `path` holds what its place in the output cannot carry: the probe
 * names the header in an `#include "..."` line, and the module names every
 * path in a comment, which `emittable` lets hold printable ASCII only.
 */
const unsafePath = (path: string): boolean => {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    if (!isPrintable(c) || c === 34 || c === 39 || c === 92) {
      return true
    }
  }
  return !emittable(path, AS_COMMENT)
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
  /** The Nish scalar for `BASE_SCALAR`. */
  scalar: string = ""
  /** `struct x` or `union x` for `BASE_RECORD`. */
  tag: string = ""
  /** Why it has no Nish type, for `BASE_REFUSED`. */
  reason: string = ""
  base: i32
  /** `CHAR_*` for `BASE_CHAR`. */
  sign: i32
  pointers: i32 = 0
  /** Whether the innermost pointed-to type is `const`. */
  constBase: boolean = false
  /** Whether what the outermost pointer points to is `const` (`T *const *` has it, `T **` not). */
  constPointee: boolean = false
  /** Whether the type itself, the outermost pointer or the value, is `const`. */
  constTop: boolean = false
  /** The outermost pointer's nullability qualifier, as spelled or through a typedef. */
  nullable: boolean = false
  nonnull: boolean = false
  /** A typedef with its own `aligned` attribute, held by value: not the scalar's natural layout. */
  aligned: boolean = false
  /** The innermost pointed-to type is a typedef with its own `aligned` attribute (kept when `aligned` is cleared for a pointer). */
  alignedBase: boolean = false
  /** The scalar is an enum's: its size is the C compiler's choice (`-fshort-enums`), so it is no buffer element. */
  enumBase: boolean = false
  /** For `BASE_ARRAY`: the element count of `T [N]`, or -1 when it is not one plain length. */
  length: i32 = -1
  /** For `BASE_ARRAY` with a `length`: the element's spelling, `T`. */
  element: string = ""

  constructor() {
    this.base = BASE_REFUSED
    this.sign = CHAR_PLAIN
  }
}

/**
 * `T [N]`, clang's spelling of an array, split into its element and length.
 * Any other shape (`T []`, `T [2][3]`, a length that is not a plain decimal)
 * keeps `length` at -1 and says why in `reason`, which `fieldType` gives.
 */
const arrayType = (spelling: string, open: i32): CType => {
  const array = new CType()
  array.base = BASE_ARRAY
  const close = spelling.indexOf("]", open)
  if (close < 0 || spelling.indexOf("[", open + 1) >= 0 || close !== spelling.length - 1) {
    array.reason = "an array of arrays"
    return array
  }
  const digits = trimSpaces(spelling.slice(open + 1, close))
  if (digits.length === 0) {
    array.reason = "a flexible array member, whose length C does not fix"
    return array
  }
  let length: i32 = 0
  for (let i = 0; i < digits.length; i++) {
    const c = digits.charCodeAt(i)
    if (c < 48 || c > 57) {
      array.reason = "an array whose length is not a plain number"
      return array
    }
    // Past the limit the digits are still read, so the reason stays true.
    length = length > 16777216 ? length : length * 10 + (c - 48)
  }
  if (length === 0) {
    array.reason = "a zero-length array"
    return array
  }
  if (length > 16777216) {
    array.reason = "an array of more than 16777216 elements, the most an array field holds"
    return array
  }
  array.length = length
  array.element = trimSpaces(spelling.slice(0, open))
  return array
}

/** Where the first `(*` or `(^` group of a spelling opens, or -1. */
const firstDeclarator = (spelling: string): i32 => {
  const star = spelling.indexOf("(*")
  const caret = spelling.indexOf("(^")
  if (star < 0) {
    return caret
  }
  return caret >= 0 && caret < star ? caret : star
}

/** The `)` that closes the `(` at `open` in `spelling`, or -1. */
const closingParen = (spelling: string, open: i32): i32 => {
  let depth = 0
  for (let i = open; i < spelling.length; i++) {
    const c = spelling.charCodeAt(i)
    if (c === 40) {
      depth++
    } else if (c === 41) {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

/** A refused type with its reason. */
const refusedType = (reason: string): CType => {
  const t = new CType()
  t.reason = reason
  return t
}

/**
 * The element of the Nish buffer a C pointer `t` is bound as under a
 * `"buffer"` override, or "" when it cannot be one: `u8` for a `void *` or a
 * `char *` of any sign (WP53 B1.1), and since WP89 S2 the scalar a single
 * pointer to `uint16_t`, `uint32_t`, `int32_t` or `float` names, the elements
 * `isForeignBuffer` in `src/types.ts` lends. A typedef with its own `aligned`
 * attribute is not the scalar's layout, and an enum's size is the C
 * compiler's choice, so neither is a buffer.
 */
const bufferElement = (t: CType): string => {
  if (t.pointers !== 1) {
    return ""
  }
  if (t.base === BASE_VOID || t.base === BASE_CHAR) {
    return "u8"
  }
  const s = t.scalar
  const lent = s === "u16" || s === "u32" || s === "i32" || s === "f32"
  return t.base === BASE_SCALAR && !t.aligned && !t.alignedBase && !t.enumBase && lent ? s : ""
}

/**
 * Why a single pointer to a scalar is still no buffer, as a clause the
 * refusal appends: an enum's or an aligned typedef's. "" for any other type.
 */
const bufferWhy = (t: CType): string => {
  if (t.pointers !== 1 || t.base !== BASE_SCALAR) {
    return ""
  }
  if (t.enumBase) {
    return "; an enum's size is the C compiler's choice, so it is no buffer element"
  }
  if (t.aligned || t.alignedBase) {
    return "; a typedef with its own `aligned` attribute is not its scalar's layout"
  }
  return ""
}

/** How the nullable refusal names a buffer: its own array type when it has one. */
const nonNullBuffer = (element: string): string => (element.length > 0 ? `a \`${element}[]\`` : "an array")

/** A struct or union declared in the header or one it includes. */
class CRecord {
  key: string = ""
  className: string = ""
  fieldNames: string[]
  fieldTypes: string[]
  fieldBitfields: boolean[]
  /** Why it is not a `declare class`, once `fit` is `FIT_NO`. */
  why: string = ""
  /** The attribute that gives it other than natural layout, or empty. */
  layout: string = ""
  /** Why its name cannot be a class in the module, or empty. */
  nameClash: string = ""
  fit: i32
  /** The header line it is declared on, for the order of the report. */
  line: i32 = 0
  isUnion: boolean = false
  complete: boolean = false
  inHeader: boolean = false
  /** Named by a `typedef struct { ... } name;`, not by a tag of its own. */
  typedefNamed: boolean = false
  /** Some declaration of it, complete or not, is in the header's own file. */
  declaredInHeader: boolean = false
  /** The header line of its first declaration there, for the report. */
  headerLine: i32 = 0
  /** An incomplete struct the module writes as an opaque `declare class`. */
  opaque: boolean = false
  /** For an incomplete struct a bound declaration names: why it stays a `CPtr`, or empty. */
  opaqueWhy: string = ""
  /** The header's doc comment on a declaration of it, as `docText` gives it, or empty. */
  doc: string = ""

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
  /** Packed (`__attribute__((packed))`): as narrow as its values allow, not an `int`. */
  packed: boolean = false
  constNames: string[]
  constValues: i64[]
  constLines: i32[]
  /** Why the enumerator has no constant, or empty: a value the generator cannot read, or one above 2^63. */
  constWhys: string[]
  /** The header's doc comment on each enumerator, as `docText` gives it, or empty. */
  constDocs: string[]

  constructor() {
    this.constNames = []
    this.constValues = []
    this.constLines = []
    this.constWhys = []
    this.constDocs = []
  }
}

/** A function declaration, the first one clang saw for the name. */
class CFunc {
  name: string = ""
  qualType: string = ""
  /** Why the header's declaration says more than a `declare function` can, or empty. */
  why: string = ""
  paramNames: string[]
  paramTypes: string[]
  line: i32 = 0
  variadic: boolean = false
  noSymbol: boolean = false
  inHeader: boolean = false
  returnsNonNull: boolean = false
  /** The header's doc comment on it, as `docText` gives it, or empty. */
  doc: string = ""

  constructor() {
    this.paramNames = []
    this.paramTypes = []
  }
}

/**
 * A report line as the module's closing comment can hold it: `name` only
 * when it is printable ASCII, and the reason only when the whole line is.
 * Every reason is this file's own wording, but one that came to hold the
 * header's text and with it a comment's end or a byte the comment cannot
 * carry is never copied.
 */
const reportLine = (name: string, why: string): string => {
  const shown =
    name.length > 0 && emittable(name, AS_COMMENT) ? name : "a declaration whose name is not printable ASCII"
  const line = `${shown}: ${why}`
  return emittable(line, AS_COMMENT) ? line : `${shown}: a reason the module cannot carry in a comment`
}

/** An object-like macro in the header's own file. */
class CMacro {
  name: string = ""
  body: string = ""
  /** Why it is not a constant; empty while it still may be. */
  why: string = ""
  value: i64 = 0
  type: string = ""
  line: i32 = 0
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
      console.log("  -o <file>           the module to write; it may not be the header itself")
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

/** The whole import: clang's answers, the tables built from them, and the module. */
class Importer {
  doc: CJson
  triple: string
  headerAbs: string
  cc: string
  /** The directory `scratchBeside` made for this import. */
  scratch: string = ""
  failure: string = ""
  curFile: string = ""
  typedefs: StringMap
  typedefTypes: string[]
  /** Per typedef, the header's doc comment on it, or empty: an opaque struct's lands there. */
  typedefDocs: string[]
  /** The header's own text, read once, for the doc comments clang points into it. */
  headerText: string = ""
  /** Per typedef, whether it carries its own `aligned` attribute. */
  typedefAligned: boolean[]
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
  /** The variables the header's own file declares, listed as not bound. */
  varNames: string[]
  varLines: i32[]
  usedOut: StringSet
  /** The out classes the function being declared needs, kept only if it is bound. */
  pendingOut: string[]
  /**
   * Whether the function being declared names a class with fields, whose
   * layout stays in this module (NL2756), so the function is not exported.
   */
  pendingLayout: boolean
  /** The class names `decideNames` gave out, which an opaque class may not take. */
  classNames: StringSet
  /** The functions that may claim their name in the module. */
  fnNames: StringSet
  /** The status `failure` exits with. */
  failureStatus: i32 = 1
  curLine: i32 = 0
  lp64: boolean
  charUnsigned: boolean
  hasAllow: boolean = false
  /** Whether `decideNames` has run: every struct's name is settled before any `fits`. */
  namesDecided: boolean = false
  /** Whether `decideOpaque` has run, after the overrides it reads. */
  opaqueDecided: boolean = false
  /** Set when `word` met text the module cannot hold: `cImport` then writes nothing. */
  refusedEmit: boolean = false

  constructor(triple: string, headerAbs: string) {
    this.typedefs = new StringMap()
    this.typedefTypes = []
    this.typedefDocs = []
    this.typedefAligned = []
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
    this.varNames = []
    this.varLines = []
    this.usedOut = new StringSet()
    this.classNames = new StringSet()
    this.fnNames = new StringSet()
    this.pendingOut = []
    this.pendingLayout = false
    this.doc = new CJson()
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
    if (v < 0 || this.doc.kind(v) !== CJ_OBJECT) {
      return -1
    }
    return this.doc.get(v, key)
  }

  text(v: i32, key: string): string {
    const x = this.member(v, key)
    return x >= 0 && this.doc.kind(x) === CJ_STRING ? this.doc.string(x) : ""
  }

  /**
   * `s` as the module may hold it: itself when `emittable` passes it as
   * `as`, else nothing, and the module is not written. Every piece of the
   * header's, the overrides' or the command line's text the module holds is
   * written through here; the checks before it list a declaration whose
   * text would fail, so a failure here is this file's own mistake.
   */
  word(s: string, as: i32): string {
    if (emittable(s, as)) {
      return s
    }
    this.refusedEmit = true
    return ""
  }

  /** Whether `v`'s member `key` is the string `s`. Allocates nothing. */
  textIs(v: i32, key: string, s: string): boolean {
    return this.doc.stringEquals(this.member(v, key), s)
  }

  /** Whether node `v`'s `kind` is `s`. Allocates nothing. */
  kindIs(v: i32, s: string): boolean {
    return this.textIs(v, "kind", s)
  }

  /** Whether node `v`'s `kind` ends with `s`. Allocates nothing. */
  kindEndsWith(v: i32, s: string): boolean {
    return this.doc.stringEndsWith(this.member(v, "kind"), s)
  }

  /** Whether `v` is an attribute naming a calling convention other than C's. */
  isCallingConvention(v: i32): boolean {
    return (
      this.kindIs(v, "MSABIAttr") ||
      this.kindIs(v, "SysVABIAttr") ||
      this.kindIs(v, "StdCallAttr") ||
      this.kindIs(v, "FastCallAttr") ||
      this.kindIs(v, "VectorCallAttr") ||
      this.kindIs(v, "RegCallAttr") ||
      this.kindIs(v, "PreserveMostAttr") ||
      this.kindIs(v, "PreserveAllAttr")
    )
  }

  flag(v: i32, key: string): boolean {
    const x = this.member(v, key)
    return x >= 0 && this.doc.kind(x) === CJ_BOOLEAN && this.doc.boolean(x)
  }

  /** The children of `v`'s `inner`, or -1 when it has none. */
  inner(v: i32): i32 {
    const x = this.member(v, "inner")
    return x >= 0 && this.doc.kind(x) === CJ_ARRAY ? x : -1
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
    const line = this.member(loc, "line")
    if (line >= 0 && this.doc.kind(line) === CJ_NUMBER) {
      this.curLine = parseInt(this.doc.numberText(line))
    }
  }

  /** Carries the state through `node`'s own range, not its children. */
  trackRange(node: i32): void {
    const range = this.member(node, "range")
    this.trackLoc(this.member(range, "begin"))
    this.trackLoc(this.member(range, "end"))
  }

  /** Carries the file state through `node`'s range and its children. */
  trackRest(node: i32): void {
    this.trackRange(node)
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
    const root = this.doc.parse(bytes)
    if (root < 0) {
      this.fail(
        `cannot read clang's AST of ${what}: not JSON, or deeper than 64 or more than 4194304 values`,
        1
      )
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
      "--",
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
    const bytes = readCapped(this.headerAbs)
    this.headerText = bytes === null ? "" : String.fromBytes(bytes, 0, bytes.length)
    const decls = this.inner(root)
    const n = this.count(decls)
    for (let i = 0; i < n; i++) {
      const node = this.doc.at(decls, i)
      this.trackLoc(this.member(node, "loc"))
      const inHeader = this.curFile === this.headerAbs
      if (this.kindIs(node, "TypedefDecl")) {
        this.readTypedef(node)
      } else if (this.kindIs(node, "RecordDecl")) {
        this.readRecord(node, inHeader)
      } else if (this.kindIs(node, "EnumDecl")) {
        // Reads its enumerators' lines in document order, carrying the state.
        this.readEnum(node, inHeader)
        continue
      } else if (this.kindIs(node, "FunctionDecl")) {
        this.readFunction(node, inHeader)
      } else if (this.kindIs(node, "VarDecl") && inHeader && !this.listedVar(node)) {
        // `extern int x; int x = 3;` is one variable, listed once.
        this.varNames.push(this.text(node, "name"))
        this.varLines.push(this.curLine)
      }
      this.trackRest(node)
    }
  }

  /**
   * The doc comment clang attached to `node` (its `FullComment` child), read
   * from the header's own text: clang's offset is the comment's first word,
   * so the margin before it is walked back to the opening slash. Empty when it has none, or one `docText` refuses.
   */
  docOf(node: i32): string {
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      if (this.kindIs(child, "FullComment")) {
        const offset = this.member(this.member(this.member(child, "range"), "begin"), "offset")
        if (offset < 0 || this.doc.kind(offset) !== CJ_NUMBER) {
          return ""
        }
        const text = this.headerText
        const at = parseInt(this.doc.numberText(offset))
        if (at < 0 || at > text.length) {
          return ""
        }
        // Back over the margin (blanks, newlines and `*`) to the `/` that opens it.
        let start = at - 1
        while (start >= 0 && at - start < DOC_MAX && isDocMargin(text.charCodeAt(start))) {
          start--
        }
        if (start < 0 || text.substring(start, start + 3) !== "/**") {
          return ""
        }
        return docText(text.slice(start, Math.min(text.length, start + DOC_MAX)))
      }
    }
    return ""
  }

  /**
   * The doc comment that ends on the header line just above `line` and
   * starts a line of its own, for a macro, which clang's AST does not hold.
   */
  docAbove(line: i32): string {
    const text = this.headerText
    let start = 0
    for (let at = 1; at < line && start >= 0; at++) {
      start = text.indexOf("\n", start)
      start = start < 0 ? -1 : start + 1
    }
    if (start <= 0) {
      return ""
    }
    const lo = Math.max(0, start - DOC_MAX)
    let above = text.slice(lo, start - 1)
    if (above.endsWith("\r")) {
      above = above.slice(0, above.length - 1)
    }
    while (above.length > 0 && (above.endsWith(" ") || above.endsWith("\t"))) {
      above = above.slice(0, above.length - 1)
    }
    if (!above.endsWith("*/")) {
      return ""
    }
    const open = lastIndexOf(above, "/**")
    if (open < 0 || trimSpaces(above.slice(lastIndexOf(above.slice(0, open), "\n") + 1, open)).length > 0) {
      return ""
    }
    const doc = docText(above.slice(open))
    // The comment has to end where `above` does: a `*/` before it is another comment's.
    return doc.length > 0 && above.indexOf("*/", open + 3) === above.length - 2 ? doc : ""
  }

  /** A struct's doc comment: its own, else the one on the typedef that names it (`typedef struct x x;`). */
  recordDoc(r: CRecord): string {
    if (r.doc.length > 0) {
      return r.doc
    }
    const t = this.typedefs.get(r.className, -1)
    return t >= 0 && t < this.typedefDocs.length ? this.typedefDocs[t] : ""
  }

  /** `doc` as the module writes it above a binding: a doc comment of one line or several. */
  docComment(doc: string): string {
    if (doc.length === 0) {
      return ""
    }
    const lines = splitByte(doc, 10)
    if (lines.length === 1) {
      return `/** ${this.word(lines[0], AS_COMMENT)} */\n`
    }
    const out = new StringBuilder()
    out.add("/**\n")
    for (let i = 0; i < lines.length; i++) {
      out.add(lines[i].length > 0 ? ` * ${this.word(lines[i], AS_COMMENT)}\n` : " *\n")
    }
    out.add(" */\n")
    return out.toText()
  }

  /** Whether `node`'s name is already listed, compared in place so the loop allocates nothing. */
  listedVar(node: i32): boolean {
    for (let i = 0; i < this.varNames.length; i++) {
      if (this.textIs(node, "name", this.varNames[i])) {
        return true
      }
    }
    return false
  }

  readTypedef(node: i32): void {
    const name = this.text(node, "name")
    const children = this.inner(node)
    let aligned = false
    for (let i = 0; i < this.count(children); i++) {
      if (this.textIs(this.doc.at(children, i), "kind", "AlignedAttr")) {
        aligned = true
      }
    }
    // C11 lets a typedef be declared again (`typedef T T;`), always as the
    // type it already names: the first type is kept, so a typedef's type
    // names only typedefs declared before it and following them ends. clang
    // puts an `aligned` on the declaration that spells it, so any one of
    // them marks the typedef.
    const seen = this.typedefs.get(name, -1)
    if (seen >= 0) {
      if (aligned && seen < this.typedefAligned.length) {
        this.typedefAligned[seen] = true
      }
      return
    }
    this.typedefs.set(name, this.typedefTypes.length)
    this.typedefTypes.push(this.qualType(node))
    this.typedefAligned.push(aligned)
    this.typedefDocs.push(this.curFile === this.headerAbs ? this.docOf(node) : "")
    // `typedef struct { ... } name;`: the tag has no name of its own, and
    // clang spells it `struct name` from here on.
    const owned = this.member(this.doc.at(children, 0), "ownedTagDecl")
    if (owned < 0 || this.text(owned, "name").length > 0) {
      return
    }
    const id = this.text(owned, "id")
    const record = this.recordIds.get(id, -1)
    if (record >= 0 && record < this.records.length) {
      const r = this.records[record]
      const key = `${r.isUnion ? "union" : "struct"} ${name}`
      const other = this.tags.get(key, -1)
      if (other >= 0 && other < this.records.length) {
        // A struct tagged `name` exists too, and clang spells both `struct
        // name`: which one a use means cannot be told, so neither is bound.
        const clash = `a struct tag and a typedef both name \`${name}\``
        this.records[other].nameClash = clash
        r.nameClash = clash
        r.key = `typedef ${name}`
        r.className = name
        return
      }
      r.key = key
      r.className = name
      r.typedefNamed = true
      this.tags.set(r.key, record)
    }
    const e = this.enumIds.get(id, -1)
    if (e >= 0) {
      this.enumTags.set(`enum ${name}`, e)
    }
  }

  readRecord(node: i32, inHeader: boolean): void {
    const name = this.text(node, "name")
    const isUnion = this.textIs(node, "tagUsed", "union")
    const key = name.length > 0 ? `${isUnion ? "union" : "struct"} ${name}` : ""
    const complete = this.flag(node, "completeDefinition")
    let index = key.length > 0 ? this.tags.get(key, -1) : -1
    if (index >= 0 && index < this.records.length && this.records[index].typedefNamed) {
      // `typedef struct { ... } name;` came first and took `struct name`.
      const clash = `a struct tag and a typedef both name \`${name}\``
      this.records[index].nameClash = clash
      this.records[index].key = `typedef ${name}`
      const twin = new CRecord()
      twin.key = key
      twin.className = name
      twin.isUnion = isUnion
      twin.nameClash = clash
      twin.line = this.curLine
      this.recordIds.set(this.text(node, "id"), this.records.length)
      this.records.push(twin)
      return
    }
    if (index < 0 || index >= this.records.length) {
      index = this.records.length
      const fresh = new CRecord()
      fresh.key = key
      fresh.className = name
      fresh.isUnion = isUnion
      fresh.line = this.curLine
      this.records.push(fresh)
      if (key.length > 0) {
        this.tags.set(key, index)
      }
    }
    this.recordIds.set(this.text(node, "id"), index)
    const r = this.records[index]
    // Every redeclaration counts: `struct x;` in the header after an included
    // header's makes `struct x` the header's to name.
    if (inHeader && !r.declaredInHeader) {
      r.declaredInHeader = true
      r.headerLine = this.curLine
    }
    if (inHeader && r.doc.length === 0) {
      r.doc = this.docOf(node)
    }
    if (!complete || r.complete) {
      return
    }
    r.complete = true
    r.inHeader = inHeader
    r.line = this.curLine
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      if (this.kindIs(child, "FieldDecl")) {
        r.fieldNames.push(this.text(child, "name"))
        r.fieldTypes.push(this.qualType(child))
        r.fieldBitfields.push(this.flag(child, "isBitfield"))
        const attrs = this.inner(child)
        for (let j = 0; j < this.count(attrs); j++) {
          const at = this.doc.at(attrs, j)
          if (r.layout.length === 0 && (this.kindIs(at, "AlignedAttr") || this.kindIs(at, "PackedAttr"))) {
            r.layout = `${this.kindIs(at, "AlignedAttr") ? "AlignedAttr" : "PackedAttr"} on field \`${r.fieldNames[r.fieldNames.length - 1]}\``
          }
        }
      } else if (this.kindIs(child, "RecordDecl")) {
        this.readRecord(child, inHeader)
      } else if (
        this.kindIs(child, "PackedAttr") ||
        this.kindIs(child, "AlignedAttr") ||
        this.kindIs(child, "MaxFieldAlignmentAttr")
      ) {
        r.layout = r.layout.length > 0 ? r.layout : this.text(child, "kind")
      }
    }
  }

  readEnum(node: i32, inHeader: boolean): void {
    const name = this.text(node, "name")
    const seen = name.length > 0 ? this.enumTags.get(`enum ${name}`, -1) : -1
    if (seen >= 0 && seen < this.enums.length && !this.hasEnumerators(node)) {
      // `enum e;` after the definition names the same enum: its values
      // stay the definition's, so its width does too. Whether its
      // enumerators are exported stays the definition's as well: a bare
      // `enum e;` in the header after an included definition does not
      // bring the other file's values (or their line numbers) in.
      this.enumIds.set(this.text(node, "id"), seen)
      this.trackRest(node)
      return
    }
    const e = new CEnum()
    e.name = name
    e.underlying = this.text(this.member(node, "fixedUnderlyingType"), "qualType")
    e.inHeader = inHeader
    const index = this.enums.length
    this.enums.push(e)
    this.enumIds.set(this.text(node, "id"), index)
    if (e.name.length > 0) {
      this.enumTags.set(`enum ${e.name}`, index)
    }
    let next: i64 = 0
    // Once one value cannot be read, the implicit ones after it count from it.
    let nextWhy = ""
    this.trackRange(node)
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      this.trackLoc(this.member(child, "loc"))
      if (this.kindIs(child, "PackedAttr")) {
        e.packed = true
      } else if (this.kindIs(child, "EnumConstantDecl")) {
        let v = next
        let why = nextWhy
        if (this.hasInitializer(child)) {
          const value = this.constantValue(child)
          why = value.length > 0 ? "" : "an enumerator whose value the generator cannot read"
          v = value.length > 0 ? parseI64(value) : 0
          if (value.length > 0 && value.charCodeAt(0) !== 45 && v < 0) {
            why = "an unsigned value above 2^63, which a Nish literal does not hold"
          }
        }
        e.constNames.push(this.text(child, "name"))
        e.constValues.push(v)
        e.constLines.push(this.curLine)
        e.constWhys.push(why)
        e.constDocs.push(inHeader ? this.docOf(child) : "")
        nextWhy = why
        // The implicit value after 2^63 - 1 is 2^63, which an i64 does not hold.
        const i64Max: i64 = parseI64("9223372036854775807")
        if (v === i64Max) {
          nextWhy = "an unsigned value above 2^63, which a Nish literal does not hold"
          next = 0
        } else {
          next = v + 1
        }
      }
      this.trackRest(child)
    }
  }

  /** Whether enum declaration `node` lists any enumerator. */
  hasEnumerators(node: i32): boolean {
    const children = this.inner(node)
    for (let i = 0; i < this.count(children); i++) {
      if (this.kindIs(this.doc.at(children, i), "EnumConstantDecl")) {
        return true
      }
    }
    return false
  }

  /**
   * Whether an enumerator spells its value: a child that is neither an
   * attribute nor a doc comment (`FullComment`). Any other child counts, so
   * one the generator does not know is read as a value and, unreadable, listed.
   */
  hasInitializer(decl: i32): boolean {
    const inner = this.inner(decl)
    for (let i = 0; i < this.count(inner); i++) {
      const child = this.doc.at(inner, i)
      if (!this.kindEndsWith(child, "Attr") && !this.kindEndsWith(child, "Comment")) {
        return true
      }
    }
    return false
  }

  /**
   * Names each unnamed parameter `argN`, or `argN_K` while another
   * parameter already holds that name, so `int f(int, int arg0)` stays two.
   */
  uniqueArgNames(f: CFunc): void {
    for (let i = 0; i < f.paramNames.length; i++) {
      if (f.paramNames[i].length === 0) {
        let name = `arg${i}`
        let k = 0
        while (f.paramNames.indexOf(name) >= 0) {
          k += 1
          name = `arg${i}_${k}`
        }
        f.paramNames[i] = name
      }
    }
  }

  readFunction(node: i32, inHeader: boolean): void {
    const name = this.text(node, "name")
    if (this.funcIndex.has(name)) {
      // A redeclaration in the header itself makes an included function the
      // header's, and an attribute it spells (`int f(int) __asm__("g");`
      // after `int f(int);`) refuses the function as on a first declaration.
      const seen = this.funcIndex.get(name, -1)
      if (seen >= 0 && seen < this.funcs.length) {
        const first = this.funcs[seen]
        if (inHeader) {
          first.inHeader = true
          first.doc = first.doc.length > 0 ? first.doc : this.docOf(node)
        }
        const again = this.inner(node)
        for (let i = 0; i < this.count(again); i++) {
          const child = this.doc.at(again, i)
          if (this.kindIs(child, "ReturnsNonNullAttr")) {
            // clang puts `returns_nonnull` on the declaration that spells it.
            first.returnsNonNull = true
          } else if (first.why.length === 0) {
            first.why = this.attrWhy(child)
          }
        }
        if (first.why.length === 0) {
          // -1 skips the prototype check: a later `int f();` keeps the earlier prototype.
          first.why = this.typeWhy(this.qualType(node), -1)
        }
      }
      return
    }
    const f = new CFunc()
    f.name = name
    f.qualType = this.qualType(node)
    f.variadic = this.flag(node, "variadic")
    f.noSymbol = this.textIs(node, "storageClass", "static") || this.flag(node, "inline")
    f.inHeader = inHeader
    f.line = this.curLine
    f.doc = inHeader ? this.docOf(node) : ""
    const children = this.inner(node)
    const n = this.count(children)
    for (let i = 0; i < n; i++) {
      const child = this.doc.at(children, i)
      if (this.kindIs(child, "ParmVarDecl")) {
        const pname = this.text(child, "name")
        f.paramNames.push(pname)
        f.paramTypes.push(this.qualType(child))
      } else if (this.kindIs(child, "CompoundStmt")) {
        f.noSymbol = true
      } else if (this.kindIs(child, "ReturnsNonNullAttr")) {
        f.returnsNonNull = true
      } else if (f.why.length === 0) {
        f.why = this.attrWhy(child)
      }
    }
    this.uniqueArgNames(f)
    if (f.why.length === 0) {
      f.why = this.typeWhy(f.qualType, f.paramTypes.length)
    }
    this.funcIndex.set(name, this.funcs.length)
    this.funcs.push(f)
  }

  /**
   * Why a function attribute keeps it from being bound, or `""`: noreturn,
   * a calling convention, an asm label or alias (its symbol is not its name)
   * or `overloadable` (clang mangles its symbol). Read on every declaration
   * of a function, since clang puts an attribute on the declaration that
   * spells it.
   */
  attrWhy(child: i32): string {
    if (
      this.kindIs(child, "C11NoReturnAttr") ||
      this.kindIs(child, "NoReturnAttr") ||
      this.kindIs(child, "CXX11NoReturnAttr")
    ) {
      return "declared noreturn, which a `declare function` cannot say"
    }
    if (this.isCallingConvention(child)) {
      return "declared with a calling convention other than the C default"
    }
    if (this.kindIs(child, "AsmLabelAttr") || this.kindIs(child, "AliasAttr")) {
      return "declared with an asm label or alias, so its symbol is not its name"
    }
    if (this.kindIs(child, "OverloadableAttr")) {
      return "declared overloadable, so clang mangles its symbol"
    }
    return ""
  }

  /**
   * Why a function's type keeps it from being bound, or `""`. The type
   * carries what its attributes change: the words are matched, never copied,
   * since an attribute's text is the header's.
   */
  typeWhy(fnType: string, paramCount: i32): string {
    if (fnType.indexOf("typeof") >= 0) {
      return "declared with a `typeof` type"
    }
    if (fnType.indexOf("(unnamed") >= 0 || fnType.indexOf("(anonymous") >= 0) {
      return "declared with an unnamed struct, union or enum"
    }
    if (fnType.indexOf("noreturn") >= 0) {
      return "declared noreturn, which a `declare function` cannot say"
    }
    if (
      fnType.indexOf("ms_abi") >= 0 ||
      fnType.indexOf("sysv_abi") >= 0 ||
      fnType.indexOf("stdcall") >= 0 ||
      fnType.indexOf("fastcall") >= 0 ||
      fnType.indexOf("vectorcall") >= 0 ||
      fnType.indexOf("regcall") >= 0 ||
      fnType.indexOf("preserve_") >= 0
    ) {
      return "declared with a calling convention other than the C default"
    }
    if (fnType.indexOf("__attribute__") >= 0) {
      return "declared with an attribute the generator cannot read"
    }
    if (fnType.endsWith("()") && paramCount === 0) {
      // C17 reads `int f()` as a function of unknown parameters, not none.
      return "declared without a prototype, so its parameters are unknown"
    }
    return ""
  }

  // ---- Types ----

  /** The C type clang spells `spelling`, following typedefs. */
  resolve(spelling: string): CType {
    // Words whose type this file cannot read in any position: refused before
    // the parenthesis checks, since `_Atomic(int)` and `_BitInt(8)` hold one.
    if (spelling.indexOf("_Atomic") >= 0) {
      return refusedType("an `_Atomic` type")
    }
    if (spelling.indexOf("_BitInt") >= 0) {
      return refusedType("a `_BitInt`")
    }
    // The attribute's own text is the header's, never copied: a string in it
    // could close the module's comment.
    if (spelling.indexOf("__attribute__") >= 0) {
      return refusedType("a type with an attribute the generator cannot read")
    }
    if (spelling.indexOf("typeof") >= 0) {
      return refusedType("a `typeof` type")
    }
    // Clang spells a struct, union or enum without a name by where it is,
    // `struct (unnamed struct at <path>:3:1)`: a path, not a type.
    if (spelling.indexOf("(unnamed") >= 0 || spelling.indexOf("(anonymous") >= 0) {
      return refusedType("an unnamed struct, union or enum")
    }
    const star = firstDeclarator(spelling)
    if (star >= 0) {
      // Clang writes the declarator inside the first `(*` group, and what
      // follows the group says what the pointer is to: `void (*[4])(int)` is
      // an array of function pointers, `int (*)[4]` a pointer to an array.
      // Either read as one function pointer would get the layout wrong.
      const close = closingParen(spelling, star)
      if (close < 0) {
        return refusedType("a type whose parentheses do not match")
      }
      const after = trimSpaces(spelling.slice(close + 1))
      if (spelling.slice(star, close).indexOf("[") >= 0) {
        const array = new CType()
        array.base = BASE_ARRAY
        array.reason = after.startsWith("(") ? "an array of function pointers" : "an array of pointers"
        return array
      }
      if (after.startsWith("[")) {
        // `int (*(*)(void))[4]`: a group inside the first is a function
        // pointer whose result is the pointer to an array.
        if (spelling.slice(star + 2, close).indexOf("(") >= 0) {
          return refusedType("a function pointer whose result is a pointer to an array")
        }
        return refusedType("a pointer to an array")
      }
      const fn = new CType()
      fn.base = BASE_FNPTR
      return fn
    }
    if (spelling.indexOf("(") >= 0) {
      const fn = new CType()
      fn.base = BASE_FUNC
      return fn
    }
    const open = spelling.indexOf("[")
    if (open >= 0) {
      return arrayType(spelling, open)
    }
    const words = typeWords(spelling)
    let pointers = 0
    let constBase = false
    // Whether a `const` qualifies the level the last `*` starts, and the one
    // before it: the second is what the outermost pointer points to.
    let levelConst = false
    let pointeeConst = false
    // A nullability qualifier follows the `*` it qualifies, so each `*` starts
    // the next pointer's state afresh and what is left is the outermost one's.
    let nullable = false
    let nonnull = false
    let tagWord = ""
    let tagName = ""
    let named = ""
    let longs = 0
    let isShort = false
    let isUnsigned = false
    let isSigned = false
    let builtin = ""
    let refusedWord = ""
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
        pointeeConst = levelConst
        levelConst = false
        nullable = false
        nonnull = false
      } else if (w === "const") {
        constBase = constBase || pointers === 0
        levelConst = true
      } else if (w === "_Nullable" || w === "_Nullable_result") {
        nullable = true
      } else if (w === "_Nonnull") {
        nonnull = true
      } else if (w === "struct" || w === "union" || w === "enum") {
        tagWord = w
      } else if (w === "long") {
        longs++
      } else if (w === "short") {
        isShort = true
      } else if (w === "unsigned") {
        isUnsigned = true
      } else if (w === "signed") {
        isSigned = true
      } else if (
        w === "_Complex" ||
        w === "_Imaginary" ||
        w === "__int128" ||
        w === "_Float16" ||
        w === "__fp16" ||
        w === "__bf16" ||
        w === "_Float128" ||
        w === "__float128" ||
        w === "__ibm128"
      ) {
        refusedWord = w
      } else if (w === "int") {
        builtin = builtin.length === 0 ? w : builtin
      } else if (w === "char" || w === "float" || w === "double" || w === "void" || w === "_Bool") {
        builtin = w
      } else {
        named = w
      }
    }
    let t = new CType()
    if (refusedWord.length > 0) {
      t = refusedType(`\`${refusedWord}\`, which has no Nish type`)
    } else if ((tagWord.length > 0 && !isIdent(tagName)) || (named.length > 0 && !isIdent(named))) {
      t = refusedType("a type the generator cannot read")
    } else if (tagWord === "enum") {
      t = this.enumType(tagName)
      t.enumBase = true
    } else if (tagWord.length > 0 && tagName.startsWith("__va_list")) {
      // A `va_list` parameter decays to a pointer to clang's own tag: the
      // pointer is the decay, not the C type the header wrote.
      return refusedType("a `va_list`")
    } else if (tagWord.length > 0) {
      t.base = BASE_RECORD
      t.tag = `${tagWord} ${tagName}`
    } else if (named.length > 0) {
      if (named.indexOf("va_list") >= 0) {
        t = refusedType("a `va_list`")
        t.pointers = pointers
        return t
      }
      const index = this.typedefs.get(named, -1)
      if (index < 0 || index >= this.typedefTypes.length || index >= this.typedefAligned.length) {
        t = refusedType(`the unknown type \`${named}\``)
        t.pointers = pointers
        return t
      }
      t = this.resolve(this.typedefTypes[index])
      if (t.pointers === 0) {
        t.constBase = t.constBase || constBase
      }
      // `const` before the typedef's name qualifies the typedef's own type.
      const typedefConst = t.constTop || constBase
      if (pointers === 1) {
        t.constPointee = typedefConst
      } else if (pointers > 1) {
        t.constPointee = pointeeConst
      }
      t.constTop = pointers > 0 ? levelConst : typedefConst
      if (pointers > 0) {
        // The outermost pointer is spelled here, so its qualifier is the one
        // spelled here; the typedef's own qualifies a pointer further in.
        t.nullable = nullable
        t.nonnull = nonnull
        t.alignedBase = t.alignedBase || t.aligned || (t.pointers === 0 && this.typedefAligned[index])
        t.aligned = false
      } else {
        if (nullable || nonnull) {
          t.nullable = nullable
          t.nonnull = nonnull
        }
        t.aligned = t.aligned || this.typedefAligned[index]
      }
      t.pointers += pointers
      return t
    } else {
      t = this.builtinType(isShort ? "short" : builtin, longs, isUnsigned, isSigned)
    }
    t.pointers = pointers
    t.constBase = constBase
    t.constPointee = pointers > 0 && pointeeConst
    t.constTop = levelConst
    t.nullable = nullable
    t.nonnull = nonnull
    return t
  }

  /**
   * The scalar an enum's values have: its fixed underlying type, else the
   * one clang picks from its values, `int` or `unsigned int` (4 bytes on
   * every target). A packed enum, or one whose values need 8 bytes, is
   * refused rather than given a width the header does not have.
   */
  enumType(name: string): CType {
    const index = this.enumTags.get(`enum ${name}`, -1)
    if (index < 0 || index >= this.enums.length) {
      const t = new CType()
      t.base = BASE_SCALAR
      t.scalar = "i32"
      return t
    }
    return this.enumScalar(this.enums[index])
  }

  /** `enumType` for an enum in hand: the one decision its type and its constants' types share. */
  enumScalar(e: CEnum): CType {
    const t = new CType()
    t.base = BASE_SCALAR
    t.scalar = "i32"
    if (e.underlying.length > 0) {
      return this.resolve(e.underlying)
    }
    if (e.packed) {
      return refusedType("a packed enum, narrower than an `int`")
    }
    let negative = false
    let aboveInt = false
    for (let i = 0; i < e.constValues.length && i < e.constWhys.length; i++) {
      const v = e.constValues[i]
      if (e.constWhys[i].length > 0 || v > 4294967295 || v < -2147483648) {
        return refusedType("an enum whose values need more than 4 bytes, or cannot be read")
      }
      negative = negative || v < 0
      aboveInt = aboveInt || v > 2147483647
    }
    if (aboveInt && negative) {
      return refusedType("an enum whose values need more than 4 bytes, or cannot be read")
    }
    t.scalar = aboveInt ? "u32" : "i32"
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

  /**
   * Whether a value of type `t` can be a buffer's count: a `u8`, `u16`, `u32`
   * or `u64` (an `unsigned char` included) by value, or through a pointer the
   * function writes (an out class). `CountedBy` takes no other type.
   */
  isCountType(t: CType): boolean {
    if (
      t.pointers > 1 ||
      (t.pointers === 1 && t.constPointee) ||
      (t.base !== BASE_SCALAR && t.base !== BASE_CHAR)
    ) {
      return false
    }
    const s = this.valueType(t)
    return s === "u8" || s === "u16" || s === "u32" || s === "u64"
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
    if (r.nameClash.length > 0) {
      return r.nameClash
    }
    if (r.layout.length > 0) {
      return `packed or aligned layout (${r.layout}), which a declare class does not follow`
    }
    if (r.fieldNames.length === 0) {
      return "no fields"
    }
    for (let i = 0; i < r.fieldNames.length && i < r.fieldTypes.length && i < r.fieldBitfields.length; i++) {
      const field = `field \`${r.fieldNames[i]}\` is `
      if (r.fieldNames[i].length === 0) {
        return "an anonymous member"
      }
      if (!isIdent(r.fieldNames[i])) {
        return `field ${i + 1}'s name is not an ASCII identifier`
      }
      if (r.fieldBitfields[i]) {
        return `${field}a bitfield`
      }
      if (isFieldReserved(r.fieldNames[i])) {
        return `${field}named with a word Nish reserves`
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
    if (t.aligned) {
      return "!a typedef with its own `aligned` attribute"
    }
    if (t.base === BASE_RECORD) {
      const index = this.recordOf(t.tag)
      if (index >= 0 && this.records[index].fit === FIT_DECIDING) {
        return "!the struct itself"
      }
      if (this.fits(index)) {
        return this.word(this.records[index].className, AS_IDENT)
      }
      return `!a struct that is not a declare class (\`${t.tag}\`)`
    }
    if (t.base === BASE_ARRAY) {
      return this.arrayField(t)
    }
    const value = this.valueType(t)
    if (value === "boolean") {
      return "!a `_Bool`, which a declare class cannot hold"
    }
    return value
  }

  /**
   * `T name[N]` as a field: `Record<integer<0, N - 1>, T>`, laid out inline
   * as C lays it out, for exactly the elements an array field holds.
   */
  arrayField(t: CType): string {
    if (t.length < 0) {
      return `!${t.reason}`
    }
    const e = this.resolve(t.element)
    if (e.pointers > 0 || e.base === BASE_FNPTR) {
      return "!an array of pointers"
    }
    if (e.aligned) {
      return "!an array of a typedef with its own `aligned` attribute"
    }
    if (e.base === BASE_RECORD) {
      return "!an array of structs"
    }
    if (e.base === BASE_ARRAY) {
      return "!an array of arrays"
    }
    const value = this.valueType(e)
    if (value.startsWith("!")) {
      return `!an array of ${value.slice(1)}`
    }
    if (
      value !== "i32" &&
      value !== "i64" &&
      value !== "u8" &&
      value !== "u16" &&
      value !== "u32" &&
      value !== "u64" &&
      value !== "f32" &&
      value !== "f64"
    ) {
      return `!an array of \`${value === "boolean" ? "_Bool" : value}\` (an array field holds only i32, i64, u8, u16, u32, u64, f32 and f64)`
    }
    return `Record<integer<0, ${this.word(`${t.length - 1}`, AS_INTEGER)}>, ${value}>`
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
    // Never more than the header says: `_Nonnull` there is not widened.
    const headerNonNull = nonnull || t.nonnull
    const orNull = (nullable || t.nullable) && !headerNonNull ? " | null" : ""
    const opaque = headerNonNull ? "CPtr" : "CPtr | null"
    if (t.pointers >= 3) {
      return "CPtr | null"
    }
    if (t.pointers === 2 || t.base === BASE_FNPTR) {
      if (t.constPointee) {
        // `T *const *`: the function reads the pointer; an out class would say it writes.
        return opaque
      }
      return this.outClass("ptr")
    }
    if (t.base === BASE_CHAR) {
      if (nonnull && !t.constPointee && this.valueType(t) === "u8") {
        // A named count the function writes through an `unsigned char *`
        // (or a plain `char *` where `char` is unsigned): its out class.
        return this.outClass("u8")
      }
      if (t.sign === CHAR_PLAIN) {
        return t.constBase ? `string${orNull}` : `CPtr${orNull}`
      }
      return opaque
    }
    if (t.base === BASE_VOID) {
      return opaque
    }
    if (t.base === BASE_SCALAR) {
      if (t.scalar === "boolean") {
        return "!a pointer to `_Bool`"
      }
      if (t.constPointee) {
        // The function reads through it: an out class would say it writes.
        return opaque
      }
      return this.outClass(t.scalar)
    }
    if (t.base === BASE_RECORD) {
      const index = this.recordOf(t.tag)
      if (this.fits(index) || (index >= 0 && this.records[index].opaque)) {
        if (!this.records[index].opaque) {
          this.pendingLayout = true
        }
        return `${this.word(this.records[index].className, AS_IDENT)}${orNull}`
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
      // An owned result is freed by handle, so it is a `CPtr` even for `char *`.
      return headerNonNull || t.nonnull ? "CPtr" : "CPtr | null"
    }
    const nonnull = mode === RETURN_NONNULL || (mode === RETURN_DEFAULT && (headerNonNull || t.nonnull))
    if (t.pointers === 1 && t.base === BASE_CHAR && t.sign === CHAR_PLAIN && t.constBase) {
      return nonnull ? "string" : "string | null"
    }
    const index = t.pointers === 1 && t.base === BASE_RECORD ? this.recordOf(t.tag) : -1
    if (index >= 0 && this.records[index].opaque) {
      return `${this.word(this.records[index].className, AS_IDENT)}${nonnull ? "" : " | null"}`
    }
    return nonnull ? "CPtr" : "CPtr | null"
  }

  // ---- Macros ----

  /** The object-like macros the header's own file defines, from `clang -E -dD`. */
  readMacros(): void {
    const argv: string[] = [this.cc, "-E", "-dD", `--target=${this.triple}`, "-x", "c", "--", this.headerAbs]
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
    // A line marker `# N "file"` says the next line is line N of `file`; every
    // other output line is the one after the last.
    let lineNo = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith("# ")) {
        const open = line.indexOf('"')
        const close = line.indexOf('"', open + 1)
        if (open > 0 && close > open) {
          file = line.slice(open + 1, close)
          lineNo = parseInt(line.slice(2, open))
        }
        continue
      }
      if (file === this.headerAbs && line.startsWith("#define ")) {
        this.readDefine(line.slice(8), lineNo)
      } else if (file === this.headerAbs && line.startsWith("#undef ")) {
        const index = this.macroIndex.get(trimSpaces(line.slice(7)), -1)
        if (index >= 0 && index < this.macros.length) {
          this.macros[index].why = "removed by a later `#undef`"
          this.macros[index].type = ""
        }
      }
      lineNo++
    }
  }

  readDefine(rest: string, line: i32): void {
    // The name runs to a space, a tab, `(` or the line's end, so a byte that
    // cannot continue an identifier (`$`, one above 127) is part of it and the
    // macro is listed, never read as the shorter name before that byte.
    let end = 0
    while (end < rest.length) {
      const c = rest.charCodeAt(end)
      if (c === 32 || c === 9 || c === 40) {
        break
      }
      end++
    }
    const name = rest.slice(0, end)
    if (name.length === 0) {
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
    m.type = ""
    m.line = line
    m.body = trimSpaces(rest.slice(end))
    if (!isIdent(name)) {
      m.why = "its name is not an ASCII identifier"
    } else if (name.startsWith("_")) {
      m.why = "a name starting with `_`, which C reserves"
    } else if (end < rest.length && rest.charCodeAt(end) === 40) {
      m.why = "a function-like macro"
    } else if (m.body.length === 0) {
      m.why = "an empty macro"
    } else if (m.body.startsWith('"')) {
      m.type = "string"
      m.why = emittable(m.body, AS_STRING)
        ? ""
        : "a string the generator does not copy (escapes, pieces, or bytes that are not printable ASCII)"
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
    argv.push("--")
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
      if (this.dropProbed(run.err, lines) === 0) {
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

  /**
   * Drops every macro whose probe line clang's diagnostics `err` name, and
   * gives how many it dropped.
   */
  dropProbed(err: u8[], lines: i32[]): i32 {
    let dropped = 0
    const errors = splitByte(clangText(err), 10)
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
    return dropped
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
      if (this.textIs(node, "kind", "EnumDecl")) {
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
   * The value clang folded an enumerator to: on its ConstantExpr (or a bare
   * integer literal), which implicit casts to the enum's type can wrap. Only
   * those casts are looked through, so no operand of an expression is taken
   * for its value. Empty when there is none.
   */
  constantValue(decl: i32): string {
    const children = this.inner(decl)
    let node = -1
    for (let i = 0; i < this.count(children) && node < 0; i++) {
      const child = this.doc.at(children, i)
      if (!this.kindEndsWith(child, "Attr") && !this.kindEndsWith(child, "Comment")) {
        node = child
      }
    }
    for (let depth = 0; depth < 8 && node >= 0; depth++) {
      const kind = this.text(node, "kind")
      if (this.kindIs(node, "ConstantExpr") || this.kindIs(node, "IntegerLiteral")) {
        return this.text(node, "value")
      }
      if (kind !== "ImplicitCastExpr") {
        return ""
      }
      const inner = this.inner(node)
      node = this.count(inner) > 0 ? this.doc.at(inner, 0) : -1
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
    } else if (size === 1 || size === 2 || size === 4) {
      m.type = size === 4 && unsigned ? "u32" : "i32"
    } else {
      m.why = "an integer wider than 8 bytes, which no Nish scalar holds"
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
    if (root < 0) {
      this.fail(`overrides: ${path} is not JSON, or holds one key twice in an object`, 1)
      return
    }
    if (this.doc.kind(root) !== CJ_OBJECT) {
      this.fail(`overrides: ${path} is not a JSON object`, 1)
      return
    }
    if (this.refuseDuplicate(root, "the file", false)) {
      return
    }
    // `allow` decides which functions are bound, so it is read, and the
    // struct names settled, before any function's override is checked
    // against the module, wherever the keys sit in the file.
    let functions = -1
    let unknown = -1
    for (let i = 0; i < this.doc.length(root); i++) {
      const value = this.doc.at(root, i)
      if (this.doc.keyIs(root, i, "header")) {
        if (this.doc.kind(value) !== CJ_STRING || !this.doc.stringEquals(value, headerName)) {
          this.fail(`overrides: "header" must be "${headerName}"`, 1)
        }
      } else if (this.doc.keyIs(root, i, "allow")) {
        this.readAllow(value)
      } else if (this.doc.keyIs(root, i, "functions")) {
        functions = value
      } else if (unknown < 0) {
        unknown = i
      }
    }
    if (unknown >= 0) {
      this.fail(`overrides: unknown key "${this.doc.keyAt(root, unknown)}"`, 1)
    }
    if (this.failure.length === 0 && !this.hasAllow && functions < 0) {
      this.fail('overrides: the file holds neither "allow" nor "functions", so it changes nothing', 1)
    }
    for (let i = 0; i < this.allow.length && this.failure.length === 0; i++) {
      let matched = false
      for (let j = 0; j < this.funcs.length && !matched; j++) {
        matched = globMatches(this.allow[i], this.funcs[j].name)
      }
      if (!matched) {
        this.fail(`overrides: "allow" glob "${this.allow[i]}" matches no function the header declares`, 1)
      }
    }
    this.decideNames()
    if (functions >= 0 && this.failure.length === 0) {
      this.readFunctionOverrides(functions)
    }
    for (let i = 0; i < this.overrides.length && this.failure.length === 0; i++) {
      this.checkOverride(this.overrides[i])
    }
    this.pendingOut = []
  }

  /**
   * Refuses an override whose function the module does not declare, or
   * whose declaration it leaves as it would be without it, so that every
   * accepted override changes a bound declaration.
   */
  checkOverride(o: FnOverride): void {
    const index = this.funcIndex.get(o.name, -1)
    if (index < 0 || index >= this.funcs.length) {
      return
    }
    const f = this.funcs[index]
    const unbound = this.whyNotDeclared(f)
    if (unbound.length > 0) {
      this.fail(`overrides: \`${o.name}\` is not bound (${unbound}), so an override cannot change it`, 1)
      return
    }
    let pairedBuffer = -1
    for (let i = 0; i < o.params.length && i < o.buffers.length && pairedBuffer < 0; i++) {
      const p = this.paramOverride(o, o.buffers[i])
      if (o.buffers[i].length > 0 && p >= 0 && p < o.buffers.length && o.buffers[p].length > 0) {
        pairedBuffer = i
      }
    }
    if (pairedBuffer >= 0 && pairedBuffer < o.params.length && pairedBuffer < o.buffers.length) {
      const count = o.buffers[pairedBuffer]
      this.fail(
        `overrides: ${this.paramWhere(f, o.params[pairedBuffer])}'s count \`${count}\` is a buffer itself, not a count`,
        1
      )
      return
    }
    if (this.functionDecl(f, true) === this.functionDecl(f, false)) {
      this.fail(`overrides: \`${o.name}\`'s override changes nothing in its declaration`, 1)
      return
    }
    if (o.returnMode === RETURN_OWNED) {
      const freer = this.funcIndex.get(o.ownedBy, -1)
      const why = freer >= 0 && freer < this.funcs.length ? this.whyNotDeclared(this.funcs[freer]) : ""
      if (why.length > 0) {
        this.fail(`overrides: \`${o.name}\` is freed by \`${o.ownedBy}\`, which is not bound (${why})`, 1)
      }
    }
  }

  /** Why the module has no `declare function` for `f`, with the overrides read so far, or empty. */
  whyNotDeclared(f: CFunc): string {
    const unbound = this.whyUnbound(f)
    if (unbound.length > 0) {
      return unbound
    }
    if (isNameReserved(f.name) || isOutName(f.name)) {
      return "its name is a word or type Nish reserves"
    }
    const decl = this.functionDecl(f, true)
    this.pendingOut = []
    return decl.startsWith("!") ? decl.slice(1) : ""
  }

  /** Refuses an object that holds one key twice, which JSON readers settle differently. */
  refuseDuplicate(object: i32, where: string, quoted: boolean): boolean {
    const seen = new StringSet()
    for (let i = 0; i < this.doc.length(object); i++) {
      const key = this.doc.keyAt(object, i)
      if (seen.has(key)) {
        this.fail(`overrides: ${quoted ? `\`${where}\`` : where} holds the key "${key}" twice`, 1)
        return true
      }
      seen.add(key)
    }
    return false
  }

  readAllow(value: i32): void {
    if (this.doc.kind(value) !== CJ_ARRAY) {
      this.fail('overrides: "allow" must be an array of name globs', 1)
      return
    }
    this.hasAllow = true
    for (let i = 0; i < this.doc.length(value); i++) {
      const glob = this.doc.at(value, i)
      if (this.doc.kind(glob) !== CJ_STRING) {
        this.fail('overrides: "allow" must be an array of name globs', 1)
        return
      }
      this.allow.push(this.doc.string(glob))
    }
  }

  readFunctionOverrides(value: i32): void {
    if (this.doc.kind(value) !== CJ_OBJECT) {
      this.fail('overrides: "functions" must be an object', 1)
      return
    }
    if (this.refuseDuplicate(value, '"functions"', false)) {
      return
    }
    if (this.doc.length(value) === 0) {
      this.fail('overrides: "functions" is an empty object, which changes nothing', 1)
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
      const unbound = this.whyUnbound(this.funcs[index])
      if (unbound.length > 0) {
        this.fail(`overrides: \`${name}\` is not bound (${unbound}), so an override cannot change it`, 1)
        return
      }
      if (this.doc.kind(body) !== CJ_OBJECT) {
        this.fail(`overrides: \`${name}\` must be an object`, 1)
        return
      }
      if (this.refuseDuplicate(body, name, true)) {
        return
      }
      if (this.doc.length(body) === 0) {
        this.fail(`overrides: \`${name}\` is an empty object, which changes nothing`, 1)
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
          if (o.returnMode === RETURN_NULLABLE && (f.returnsNonNull || this.returnNonnull(f))) {
            this.fail(
              `overrides: \`${name}\` returns a \`_Nonnull\` or \`returns_nonnull\` pointer, so it cannot be nullable`,
              1
            )
            return
          }
          if (o.returnMode !== RETURN_OWNED && this.functionReturn(f, o) === result) {
            this.fail(`overrides: \`${name}\` returns \`${result}\` already, so "return" changes nothing`, 1)
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
    if (kind === CJ_STRING && this.doc.stringEquals(value, "nonnull")) {
      o.returnMode = RETURN_NONNULL
      return
    }
    if (kind === CJ_STRING && this.doc.stringEquals(value, "nullable")) {
      o.returnMode = RETURN_NULLABLE
      return
    }
    const owner = this.text(value, "owned")
    if (kind === CJ_OBJECT && this.doc.length(value) === 1 && owner.length > 0) {
      const freer = this.funcIndex.get(owner, -1)
      if (freer < 0 || freer >= this.funcs.length) {
        this.fail(`overrides: \`${o.name}\` is freed by \`${owner}\`, which the header does not declare`, 1)
        return
      }
      const unbound = this.whyUnbound(this.funcs[freer])
      if (unbound.length > 0) {
        this.fail(`overrides: \`${o.name}\` is freed by \`${owner}\`, which is not bound (${unbound})`, 1)
        return
      }
      o.returnMode = RETURN_OWNED
      o.ownedBy = owner
      return
    }
    this.fail(`overrides: \`${o.name}\` "return" must be "nonnull" or { "owned": "<function>" }`, 1)
  }

  /** How a failure names parameter `param` of `f`. */
  paramWhere(f: CFunc, param: string): string {
    return `\`${f.name}\` parameter \`${param}\``
  }

  readParamOverride(f: CFunc, o: FnOverride, param: string, value: i32): void {
    let at = -1
    for (let i = 0; i < f.paramNames.length; i++) {
      if (f.paramNames[i] === param) {
        at = i
      }
    }
    if (at < 0 || at >= f.paramTypes.length) {
      this.fail(`overrides: \`${f.name}\` has no parameter \`${param}\``, 1)
      return
    }
    if (this.doc.kind(value) !== CJ_OBJECT) {
      this.fail(`overrides: ${this.paramWhere(f, param)} must be an object`, 1)
      return
    }
    if (this.refuseDuplicate(value, this.paramWhere(f, param), false)) {
      return
    }
    if (this.doc.length(value) === 0) {
      this.fail(`overrides: ${this.paramWhere(f, param)} is an empty object, which changes nothing`, 1)
      return
    }
    let buffer = ""
    let readonly = false
    let nullable = false
    let unknown = -1
    let bufferAt = -1
    let problem = ""
    for (let i = 0; i < this.doc.length(value) && unknown < 0 && problem.length === 0; i++) {
      const v = this.doc.at(value, i)
      const isBool = this.doc.kind(v) === CJ_BOOLEAN
      if (this.doc.keyIs(value, i, "buffer") && this.doc.kind(v) === CJ_STRING) {
        bufferAt = v
        if (this.doc.stringEquals(v, "")) {
          problem = '"buffer" must name the count parameter'
        }
      } else if (this.doc.keyIs(value, i, "readonly") && isBool) {
        readonly = this.doc.boolean(v)
        if (!readonly) {
          problem = '"readonly": false changes nothing; only true has an effect'
        }
      } else if (this.doc.keyIs(value, i, "nullable") && isBool) {
        nullable = this.doc.boolean(v)
        if (!nullable) {
          problem = '"nullable": false changes nothing; only true has an effect'
        }
      } else {
        unknown = i
      }
    }
    if (problem.length > 0) {
      this.fail(`overrides: ${this.paramWhere(f, param)}: ${problem}`, 1)
      return
    }
    if (unknown >= 0) {
      this.fail(
        `overrides: ${this.paramWhere(f, param)}: unknown or mistyped key "${this.doc.keyAt(value, unknown)}"`,
        1
      )
      return
    }
    if (bufferAt >= 0) {
      buffer = this.doc.string(bufferAt)
    }
    const t = this.resolve(f.paramTypes[at])
    if (nullable && t.pointers === 0) {
      this.fail(`overrides: ${this.paramWhere(f, param)} is not a pointer, so it cannot be nullable`, 1)
      return
    }
    if (nullable && buffer.length > 0) {
      this.fail(
        `overrides: ${this.paramWhere(f, param)} is a buffer, ${nonNullBuffer(bufferElement(t))} that cannot be null, so it cannot be nullable`,
        1
      )
      return
    }
    if (nullable && t.nonnull) {
      this.fail(
        `overrides: ${this.paramWhere(f, param)} is \`_Nonnull\` in the header, so it cannot be nullable`,
        1
      )
      return
    }
    if (nullable) {
      // Only a type that `nullable` widens to `| null` takes it: one already
      // nullable, an out class or a refused type would ignore it.
      const before = this.paramType(t, false, false)
      const after = this.paramType(t, true, false)
      this.pendingOut = []
      if (before.startsWith("!") || before === after) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)} is bound as \`${before.startsWith("!") ? "not bound" : before}\` already, so "nullable" changes nothing`,
          1
        )
        return
      }
    }
    if (buffer.length > 0) {
      const element = bufferElement(t)
      if (element.length === 0) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)} is a buffer, so it must be a \`void *\` or \`char *\`, or a pointer to \`uint16_t\`, \`uint32_t\`, \`int32_t\` or \`float\`${bufferWhy(t)}`,
          1
        )
        return
      }
      if (readonly && !t.constBase) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)} is readonly, but the header lets the function write it`,
          1
        )
        return
      }
      if (readonly) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)} is \`const\` in the header, so it is bound \`readonly ${element}[]\` already and "readonly" changes nothing`,
          1
        )
        return
      }
      const countAt = f.paramNames.indexOf(buffer)
      if (countAt < 0 || countAt >= f.paramTypes.length) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)}'s count \`${buffer}\` is not a parameter of \`${f.name}\``,
          1
        )
        return
      }
      if (countAt === at) {
        this.fail(`overrides: ${this.paramWhere(f, param)} cannot be its own count`, 1)
        return
      }
      if (!this.isCountType(this.resolve(f.paramTypes[countAt]))) {
        this.fail(
          `overrides: ${this.paramWhere(f, param)}'s count \`${buffer}\` must be a \`u8\`, \`u16\`, \`u32\` or \`u64\`, passed by value or through a pointer the function writes`,
          1
        )
        return
      }
      readonly = t.constBase
    } else if (readonly) {
      this.fail(`overrides: ${this.paramWhere(f, param)} is readonly but not a buffer`, 1)
      return
    }
    o.params.push(param)
    o.buffers.push(buffer)
    o.readonlys.push(readonly)
    o.nullables.push(nullable)
  }

  /** The count parameter of buffer `param` of `f` under `o`, as an index of `f`'s parameters, or -1. */
  countOf(f: CFunc, o: FnOverride | null, param: string): i32 {
    const p = this.paramOverride(o, param)
    if (o === null || p < 0 || p >= o.buffers.length || o.buffers[p].length === 0) {
      return -1
    }
    return f.paramNames.indexOf(o.buffers[p])
  }

  /** Whether `param` of `f` is the count of a buffer in `named`, one `CountedBy` names. */
  isNamedCount(f: CFunc, o: FnOverride | null, param: string, named: StringSet): boolean {
    for (let i = 0; i < f.paramNames.length; i++) {
      if (named.has(f.paramNames[i]) && this.countOf(f, o, f.paramNames[i]) === f.paramNames.indexOf(param)) {
        return true
      }
    }
    return false
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

  /**
   * Why a declared function gets no `declare function` whatever the override
   * file says, or the empty string when it may get one.
   */
  whyUnbound(f: CFunc): string {
    if (!this.selected(f)) {
      return this.hasAllow ? '"allow" does not name it' : "declared in another header"
    }
    if (!isIdent(f.name)) {
      return "its name is not an ASCII identifier"
    }
    if (f.noSymbol) {
      return "static or inline"
    }
    if (f.variadic) {
      return "variadic"
    }
    return f.why
  }

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
  functionDecl(f: CFunc, useOverride: boolean): string {
    if (!isIdent(f.name)) {
      return "!its name is not an ASCII identifier"
    }
    if (f.noSymbol) {
      return "!has no symbol to link (static or inline)"
    }
    if (f.variadic) {
      return "!variadic"
    }
    if (f.why.length > 0) {
      return `!${f.why}`
    }
    const oi = useOverride ? this.overrideIndex.get(f.name, -1) : -1
    const o: FnOverride | null = oi >= 0 && oi < this.overrides.length ? this.overrides[oi] : null
    const params = new StringBuilder()
    const counts = new StringSet()
    // A reserved name gains `_`, then `_1`, `_2`, ... until it is no other
    // parameter's name, so `int f(int in, int in_)` stays two parameters.
    // Every name is settled first: a `CountedBy` names a later parameter.
    const outNames: string[] = []
    for (let i = 0; i < f.paramNames.length && i < f.paramTypes.length; i++) {
      const name = f.paramNames[i]
      if (!isIdent(name)) {
        return `!parameter ${i + 1}'s name is not an ASCII identifier`
      }
      const base = nishName(name)
      let out = base
      let k = 0
      while (outNames.indexOf(out) >= 0 || (out !== name && f.paramNames.indexOf(out) >= 0)) {
        k += 1
        out = `${base}${k}`
      }
      outNames.push(out)
    }
    // A `u64` straight after its buffer is WP53's positional pair; any other
    // count is named by its buffer and keeps its own type. A named count the
    // function reads through a pointer is that pointer's out class, never
    // `| null`: the call loads the count from it, as the override says.
    const named = new StringSet()
    for (let i = 0; i < f.paramNames.length && i < f.paramTypes.length; i++) {
      const countAt = this.countOf(f, o, f.paramNames[i])
      if (countAt >= 0 && countAt < f.paramTypes.length) {
        const count = this.resolve(f.paramTypes[countAt])
        if (countAt === i + 1 && count.pointers === 0 && count.scalar === "u64") {
          counts.add(f.paramNames[countAt])
        } else {
          named.add(f.paramNames[i])
        }
      }
    }
    for (let i = 0; i < f.paramNames.length && i < f.paramTypes.length; i++) {
      const name = f.paramNames[i]
      const p = this.paramOverride(o, name)
      const countAt = this.countOf(f, o, name)
      let type = ""
      if (o !== null && countAt >= 0 && countAt < outNames.length) {
        const countName = outNames[countAt]
        const element = bufferElement(this.resolve(f.paramTypes[i]))
        type = o.readonlys[p] ? `readonly ${element}[]` : `${element}[]`
        if (named.has(name)) {
          type = `CountedBy<${type}, "${this.word(countName, AS_IDENT)}">`
        }
      } else if (counts.has(name)) {
        type = "u64"
      } else {
        const nullable = o !== null && p >= 0 && p < o.nullables.length && o.nullables[p]
        type = this.paramType(this.resolve(f.paramTypes[i]), nullable, this.isNamedCount(f, o, name, named))
      }
      if (type.startsWith("!")) {
        return `!parameter \`${name}\` is ${type.slice(1)}`
      }
      if (i > 0) {
        params.add(", ")
      }
      const shown = i >= 0 && i < outNames.length ? outNames[i] : name
      params.add(`${this.word(shown, AS_IDENT)}: ${type}`)
    }
    const ret = this.functionReturn(f, o)
    if (ret.startsWith("!")) {
      return `!returns ${ret.slice(1)}`
    }
    const owned =
      o !== null && o.returnMode === RETURN_OWNED
        ? `// The result is owned: free it with ${this.word(o.ownedBy, AS_IDENT)}.\n`
        : ""
    return `${owned}declare function ${this.word(f.name, AS_IDENT)}(${params.toText()}): ${ret}`
  }

  /** Whether `f`'s result type is marked `_Nonnull`, as spelled or through a typedef. */
  returnNonnull(f: CFunc): boolean {
    const spelling = this.returnSpelling(f)
    return spelling.indexOf("(") < 0 && this.resolve(spelling).nonnull
  }

  /** The Nish type of `f`'s result, read from the part of its type before its parameter list. */
  functionReturn(f: CFunc, o: FnOverride | null): string {
    // `int (*f(void))[4]` is spelled `int (*(void))[4]`: what precedes the
    // parameter list is not the whole result, which is a pointer to an array.
    if (trimSpaces(f.qualType).endsWith("]")) {
      return "!a pointer to an array"
    }
    const spelling = this.returnSpelling(f)
    if (spelling.indexOf("(") >= 0) {
      return "!a function pointer"
    }
    const mode = o === null ? RETURN_DEFAULT : o.returnMode
    return this.returnType(this.resolve(spelling), mode, f.returnsNonNull)
  }

  /** The spelling of `f`'s result type: its function type before the parameter list. */
  returnSpelling(f: CFunc): string {
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
    return trimSpaces(f.qualType.slice(0, open < 0 ? 0 : open))
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
      fields.push(`  ${this.word(r.fieldNames[i], AS_IDENT)}: ${this.fieldType(t)}\n`)
    }
    out.add(`${this.docComment(this.recordDoc(r))}declare class ${this.word(r.className, AS_IDENT)} {\n`)
    for (let i = 0; i < fields.length; i++) {
      out.add(fields[i])
    }
    out.add("}\n\n")
  }

  /**
   * Why the constant `name` cannot be declared: a reserved word, or a name the
   * module already gives to a function, class or earlier constant. Empty when
   * it can, and then the name is claimed.
   */
  claimConst(name: string, names: StringMap, owners: string[]): string {
    if (isNameReserved(name)) {
      return "a word Nish reserves"
    }
    if (isOutName(name)) {
      return "the name of an out class the module may declare"
    }
    const owner = names.get(name, -1)
    if (owner >= 0 && owner < owners.length) {
      return `the module already gives \`${name}\` to ${owners[owner]}`
    }
    names.set(name, owners.length)
    owners.push("an earlier constant")
    return ""
  }

  /**
   * The type of an enumerator: the enum's own scalar, from the same
   * decision as `enumType`, or empty when the enum has none.
   */
  enumConstType(e: CEnum): string {
    const t = this.enumScalar(e)
    return t.pointers === 0 && t.base === BASE_SCALAR && t.scalar !== "boolean" ? t.scalar : ""
  }

  /**
   * Settles which structs keep their names, before any `fits` decides a
   * class from them, so a pointer to a struct that loses its name is a
   * `CPtr` everywhere. Needs `allow` read, since the functions it selects
   * claim names first.
   */
  decideNames(): void {
    if (this.namesDecided) {
      return
    }
    this.namesDecided = true
    const candidates = this.fnNames
    for (let i = 0; i < this.funcs.length; i++) {
      const f = this.funcs[i]
      if (this.selected(f) && !f.noSymbol && !f.variadic && !isNameReserved(f.name) && !isOutName(f.name)) {
        candidates.add(f.name)
      }
    }
    const classNames = this.classNames
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i]
      if (!r.inHeader || !r.complete || r.className.length === 0 || r.isUnion || r.nameClash.length > 0) {
        continue
      }
      if (!isIdent(r.className)) {
        r.nameClash = "its name is not an ASCII identifier"
      } else if (isClassReserved(r.className)) {
        r.nameClash = `its name \`${r.className}\` is a word or type Nish reserves`
      } else if (candidates.has(r.className)) {
        r.nameClash = `the module gives \`${r.className}\` to the function \`${r.className}\``
      } else if (classNames.has(r.className)) {
        r.nameClash = `the module already gives \`${r.className}\` to another struct`
      } else {
        classNames.add(r.className)
      }
    }
    // A class decided before now saw the old names: decide it again.
    for (let i = 0; i < this.records.length; i++) {
      this.records[i].fit = FIT_UNKNOWN
      this.records[i].why = ""
    }
  }

  /** Notes that struct `index` stays a `CPtr`, with the first reason found. */
  keepCPtr(index: i32, why: string): void {
    if (index >= 0 && index < this.records.length && this.records[index].opaqueWhy.length === 0) {
      this.records[index].opaqueWhy = why
    }
  }

  /** The struct a pointer of type `t` points to, or -1. */
  pointee(t: CType): i32 {
    return t.base === BASE_RECORD && t.pointers > 0 ? this.recordOf(t.tag) : -1
  }

  /**
   * Decides which incomplete structs of the header become an opaque
   * `declare class`: one that a bound function returns by single pointer,
   * that no bound function reaches through a pointer to a pointer (an
   * `OutPtr` or `CPtr` holds that, and gives back a `CPtr`), that no owned
   * result returns (freed by handle, a `CPtr`), and that no class's field
   * points to (a field holds only a `CPtr`). Any of those would hand the
   * caller a `CPtr` where the class is wanted, so the struct stays a `CPtr`.
   */
  decideOpaque(): void {
    if (this.opaqueDecided) {
      return
    }
    this.opaqueDecided = true
    this.decideNames()
    const returned: boolean[] = []
    const named: boolean[] = []
    for (let i = 0; i < this.records.length; i++) {
      returned.push(false)
      named.push(false)
    }
    for (let i = 0; i < this.funcs.length; i++) {
      const f = this.funcs[i]
      if (!this.selected(f) || isNameReserved(f.name) || isOutName(f.name)) {
        continue
      }
      const decl = this.functionDecl(f, true)
      this.pendingOut = []
      if (decl.startsWith("!")) {
        continue
      }
      const oi = this.overrideIndex.get(f.name, -1)
      const o: FnOverride | null = oi >= 0 && oi < this.overrides.length ? this.overrides[oi] : null
      for (let j = 0; j < f.paramNames.length && j < f.paramTypes.length; j++) {
        const p = this.paramOverride(o, f.paramNames[j])
        if (o !== null && p >= 0 && p < o.buffers.length && o.buffers[p].length > 0) {
          continue
        }
        const t = this.resolve(f.paramTypes[j])
        const at = this.pointee(t)
        if (at >= 0 && at < named.length) {
          named[at] = true
        }
        if (t.pointers >= 2) {
          this.keepCPtr(
            this.pointee(t),
            `\`${f.name}\` takes a pointer to a pointer to it, which only a \`CPtr\` can stand for`
          )
        }
      }
      const spelling = this.returnSpelling(f)
      const t = spelling.indexOf("(") >= 0 ? new CType() : this.resolve(spelling)
      const index = this.pointee(t)
      if (index >= 0 && index < named.length) {
        named[index] = true
      }
      if (t.pointers >= 2) {
        this.keepCPtr(
          index,
          `\`${f.name}\` returns a pointer to a pointer to it, which only a \`CPtr\` can stand for`
        )
      } else if (o !== null && o.returnMode === RETURN_OWNED) {
        this.keepCPtr(index, `\`${f.name}\` returns it owned, and an owned result is a \`CPtr\``)
      } else if (index >= 0 && index < returned.length) {
        returned[index] = true
      }
    }
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i]
      if (!r.inHeader || !r.complete || !this.fits(i)) {
        continue
      }
      for (let j = 0; j < r.fieldTypes.length && j < r.fieldNames.length; j++) {
        const index = this.pointee(this.resolve(r.fieldTypes[j]))
        if (index >= 0 && index < named.length) {
          named[index] = true
        }
        this.keepCPtr(
          index,
          `the field \`${r.fieldNames[j]}\` of \`${r.key}\` points to it, and a field holds only a \`CPtr\``
        )
      }
    }
    for (let i = 0; i < this.records.length && i < named.length && i < returned.length; i++) {
      const r = this.records[i]
      if (
        !named[i] ||
        !r.declaredInHeader ||
        r.complete ||
        r.isUnion ||
        r.className.length === 0 ||
        r.nameClash.length > 0
      ) {
        // Only an incomplete struct of the header that the module names is reported.
        r.opaqueWhy = ""
        continue
      }
      if (r.opaqueWhy.length > 0) {
        continue
      }
      if (!returned[i]) {
        r.opaqueWhy =
          "no function the module binds returns it, so the module could make no value of a class for it"
      } else if (!isIdent(r.className)) {
        r.opaqueWhy = "its name is not an ASCII identifier"
      } else if (isClassReserved(r.className)) {
        r.opaqueWhy = `its name \`${r.className}\` is a word or type Nish reserves`
      } else if (this.fnNames.has(r.className)) {
        r.opaqueWhy = `the module gives \`${r.className}\` to the function \`${r.className}\``
      } else if (this.classNames.has(r.className)) {
        r.opaqueWhy = `the module already gives \`${r.className}\` to another struct`
      } else {
        this.classNames.add(r.className)
        r.opaque = true
      }
    }
  }

  /** The whole generated module. */
  emit(args: CImportArgs): string {
    const out = new StringBuilder()
    const regenerate = new StringBuilder()
    regenerate.add(`${CLI} c-import ${shellWord(args.header)}`)
    if (args.overrides.length > 0) {
      regenerate.add(` --overrides ${shellWord(args.overrides)}`)
    }
    regenerate.add(` --target ${this.triple} -o ${shellWord(basename(args.out))}`)
    out.add(`${C_IMPORT_MARKER} from ${this.word(args.header, AS_COMMENT)}. Do not edit; regenerate it.\n`)
    out.add(`// Target: ${this.word(this.triple, AS_COMMENT)}\n`)
    out.add(`${DATA_MODEL_LINE}${dataModelOf(this.triple)}\n`)
    out.add(`// Regenerate: ${this.word(regenerate.toText(), AS_COMMENT)}\n\n`)

    // The report lists what is not bound in header order: each entry carries
    // its declaration's line, and functions from other headers go last.
    const report: string[] = []
    const reportLines: i32[] = []

    // The names the module gives out, each to its first claimant: functions,
    // then classes, then constants, so a constant never shadows a declaration.
    const names = new StringMap()
    const owners: string[] = []
    this.decideOpaque()

    const functions = new StringBuilder()
    for (let i = 0; i < this.funcs.length; i++) {
      const f = this.funcs[i]
      if (this.selected(f)) {
        this.pendingOut = []
        this.pendingLayout = false
        let decl = this.functionDecl(f, true)
        if (!decl.startsWith("!") && (isNameReserved(f.name) || isOutName(f.name))) {
          decl = "!its name is a word or type Nish reserves"
        }
        if (decl.startsWith("!")) {
          report.push(reportLine(f.name, decl.slice(1)))
          reportLines.push(f.inHeader ? f.line : 1000000000 + i)
        } else {
          // Another module may import a function whose types are all its
          // own to pass: an out class or a class with fields stays here.
          const exported = this.pendingOut.length === 0 && !this.pendingLayout
          const at = decl.indexOf("declare function ")
          const shown = exported && at >= 0 ? `${decl.substring(0, at)}export ${decl.slice(at)}` : decl
          functions.add(`${this.docComment(f.doc)}${shown}\n`)
          names.set(f.name, owners.length)
          owners.push(`the function \`${f.name}\``)
          for (let j = 0; j < this.pendingOut.length; j++) {
            this.usedOut.add(this.pendingOut[j])
          }
        }
      } else if (f.inHeader) {
        report.push(reportLine(f.name, '"allow" does not name it'))
        reportLines.push(f.line)
      }
    }
    for (let i = 0; i < this.varNames.length && i < this.varLines.length; i++) {
      report.push(reportLine(this.varNames[i], "a variable, which the generator does not bind"))
      reportLines.push(this.varLines[i])
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
          names.set(r.className, owners.length)
          owners.push(`the struct \`${r.key}\``)
        } else {
          report.push(reportLine(r.key, r.why))
          reportLines.push(r.line)
        }
      } else if (r.opaque) {
        out.add(`${this.docComment(this.recordDoc(r))}export declare class ${this.word(r.className, AS_IDENT)} {}\n\n`)
        names.set(r.className, owners.length)
        owners.push(`the struct \`${r.key}\``)
      } else if (r.opaqueWhy.length > 0) {
        report.push(reportLine(r.key, `stays a \`CPtr\`: ${r.opaqueWhy}`))
        reportLines.push(r.headerLine)
      } else if (r.nameClash.length > 0 && r.className.length > 0) {
        report.push(reportLine(r.key.length > 0 ? r.key : r.className, r.nameClash))
        reportLines.push(r.line)
      }
    }

    const consts = new StringBuilder()
    for (let i = 0; i < this.enums.length; i++) {
      const e = this.enums[i]
      for (
        let j = 0;
        e.inHeader && j < e.constNames.length && j < e.constValues.length && j < e.constLines.length;
        j++
      ) {
        const name = e.constNames[j]
        const type = this.enumConstType(e)
        let why = j < e.constWhys.length ? e.constWhys[j] : ""
        if (why.length === 0 && !isIdent(name)) {
          why = "its name is not an ASCII identifier"
        }
        if (why.length === 0) {
          why =
            type.length > 0
              ? this.claimConst(name, names, owners)
              : `an enumerator of ${this.enumScalar(e).reason.length > 0 ? this.enumScalar(e).reason : "a type that has no Nish scalar"}`
        }
        if (why.length > 0) {
          report.push(reportLine(name, why))
          reportLines.push(e.constLines[j])
        } else {
          consts.add(
            `${this.docComment(j < e.constDocs.length ? e.constDocs[j] : "")}export const ${this.word(name, AS_IDENT)}: ${this.word(type, AS_IDENT)} = ${this.word(`${e.constValues[j]}`, AS_INTEGER)}\n`
          )
        }
      }
    }
    for (let i = 0; i < this.macros.length; i++) {
      const m = this.macros[i]
      const why = m.why.length > 0 ? m.why : this.claimConst(m.name, names, owners)
      if (why.length > 0) {
        report.push(reportLine(m.name, why))
        reportLines.push(m.line)
      } else if (m.type === "string") {
        consts.add(`${this.docComment(this.docAbove(m.line))}export const ${this.word(m.name, AS_IDENT)}: string = ${this.word(m.body, AS_STRING)}\n`)
      } else {
        consts.add(
          `${this.docComment(this.docAbove(m.line))}export const ${this.word(m.name, AS_IDENT)}: ${this.word(m.type, AS_IDENT)} = ${this.word(`${m.value}`, AS_INTEGER)}\n`
        )
      }
    }
    sortReport(report, reportLines)
    if (!consts.isEmpty()) {
      out.add(consts.toText())
      out.add("\n")
    }
    out.add(functions.toText())
    if (report.length > 0) {
      out.add("\n/* Not bound:\n")
      for (let i = 0; i < report.length; i++) {
        const line = this.word(report[i], AS_COMMENT)
        out.add(" *   ")
        out.add(line)
        out.add("\n")
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
 * @param argv - the process arguments, `c-import` at index 1.
 * @returns the exit status: 0 written, 1 refused, 2 a usage error, 3 no clang.
 */
export const cImport = (argv: string[]): i32 => {
  const args = parseArgs(argv)
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
      "c-import: a path holds a quote, a backslash, a comment delimiter or a byte that is not printable ASCII, which the module cannot carry"
    )
    return 1
  }
  const outAbs = realpathSync(args.out)
  if (outAbs !== null && outAbs === headerAbs) {
    console.error(`c-import: -o ${args.out} is the header itself, which the module would overwrite`)
    return 1
  }
  const overridesAbs: string | null = args.overrides.length > 0 ? realpathSync(args.overrides) : null
  if (outAbs !== null && overridesAbs !== null && outAbs === overridesAbs) {
    console.error(`c-import: -o ${args.out} is the overrides file, which the module would overwrite`)
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
  const text = importer.emit(args)
  if (importer.refusedEmit) {
    console.error("c-import: a name or value the module would hold is not plain ASCII; nothing written")
    return 1
  }
  writeFileSync(args.out, text)
  return 0
}
