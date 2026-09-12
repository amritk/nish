// Package-scoped symbols for stage1 (`src/packages.ts`, WP21 S1,
// docs/wp21-packages.md §5a).
//
// The whole-program fact fixpoint in `self/attributes.ts` is keyed by the
// symbol a function is emitted under, so until now a symbol *was* a bare name
// and two packages that each kept a private `helper()` could not be compiled
// into one program: whichever was collected second would have been handed the
// first one's purity, escape and pointer facts. That is a miscompile rather
// than a link error, which is why `Compilation.rejectSymbolClashes` refuses it
// outright.
//
// The fix is to give every symbol a package scope: a module belongs to exactly
// one package, the symbols it declares carry that package's prefix, and the
// fact table is keyed by the qualified symbol — so a name is never a key
// again, a package-scoped symbol is.
//
// **The root package's prefix is empty**, which is the whole of why this stage
// moves no IR: a program compiled today is one package, so every symbol it
// emits is spelled exactly as it was, every golden is byte-identical, and
// every exported name keeps the C ABI it had.
//
// **How a module says which package it is in.** It does not: the path says it.
// A module under `<...>/node_modules/<name>/` (or `.../@scope/<name>/`) is in
// that package; everything sharing the entry's own package directory is the
// root package. POSIX separators only, as everywhere else in `self/`
// (`self/paths.ts`): stage0 accepts a backslash too and the two agree for
// every name either compiler is given.
//
// TODO(WP21 S2): when bare specifiers resolve through the `nish` export
// condition, the package a module is in becomes something the resolver states
// rather than something a path is read for, and only the mangling below stays.

import { splitByte, StringBuilder } from "./strings";

/** The package every ordinary program is: no prefix, so no symbol moves. */
export const ROOT_PACKAGE: string = "";

/** The directory segment that introduces a package, as npm lays one out. */
const PACKAGE_ROOT_SEGMENT: string = "node_modules";

const SLASH: i32 = 47; // '/'
const AT: i32 = 64; // '@'
const UNDERSCORE: i32 = 95;
const DIGIT_0: i32 = 48;
const DIGIT_9: i32 = 57;
const UPPER_A: i32 = 65;
const UPPER_Z: i32 = 90;
const LOWER_A: i32 = 97;
const LOWER_Z: i32 = 122;

/**
 * Where the innermost `node_modules` of a path is, or -1 when it has none. The
 * innermost one, because a dependency's own `node_modules` holds its own
 * dependencies: the last one on the path is the one that owns the file.
 */
function packageRootAt(segments: string[]): i32 {
  let at = -1;
  let i = 0;
  while (i + 1 < segments.length) {
    if (segments[i] === PACKAGE_ROOT_SEGMENT && segments[i + 1].length > 0) {
      at = i;
    }
    i = i + 1;
  }
  return at;
}

/** How many leading segments make up the package root, or 0 for no package. */
function packageRootLength(segments: string[], at: i32): i32 {
  if (at < 0) {
    return 0;
  }
  // `@scope/name` is two segments and one package name.
  if (segments[at + 1].startsWith("@") && at + 2 < segments.length) {
    return at + 3;
  }
  return at + 2;
}

/** `segments[from..to)` joined with `/`. */
function joinSegments(segments: string[], from: i32, to: i32): string {
  const parts: string[] = [];
  let i = from;
  while (i < to) {
    parts.push(segments[i]);
    i = i + 1;
  }
  return parts.join("/");
}

/**
 * The package directory a module lives in, or `""` when it is in none. Two
 * modules are in the same package exactly when this answers the same string
 * for both, which is the comparison `Compilation` makes against the entry:
 * comparing directories rather than names is what keeps a compiler invoked on
 * a file inside `node_modules/<pkg>` from deciding that its own entry is a
 * dependency of itself.
 */
export function packageDirOf(modulePath: string): string {
  const segments = splitByte(modulePath, SLASH);
  const length = packageRootLength(segments, packageRootAt(segments));
  if (length === 0) {
    return "";
  }
  return joinSegments(segments, 0, length);
}

/** The package a module belongs to (`hash`, `@scope/hash`), or `""` for none. */
export function packageNameOf(modulePath: string): string {
  const segments = splitByte(modulePath, SLASH);
  const at = packageRootAt(segments);
  const length = packageRootLength(segments, at);
  if (length === 0) {
    return ROOT_PACKAGE;
  }
  return joinSegments(segments, at + 1, length);
}

/**
 * The prefix every symbol of `packageName` carries: `""` for the root package,
 * and otherwise the name reduced to what an LLVM symbol and a C identifier can
 * both hold, with a `.` separator — the one methods already use
 * (`Point.shifted`), so `--emit-header` declares such a symbol the way it has
 * always declared a method: as `hash_helper` with an asm label.
 *
 * The mangling is not injective (`@scope/hash` and `scope_hash` reduce to one
 * prefix). It does not have to be: `rejectSymbolClashes` runs over the
 * *qualified* symbols, so two packages that reduce to one prefix are refused
 * with a name in the message rather than silently sharing a fact table.
 */
export function packageSymbolPrefix(packageName: string): string {
  if (packageName === ROOT_PACKAGE) {
    return "";
  }
  const out = new StringBuilder();
  let i = 0;
  while (i < packageName.length) {
    const code = packageName.charCodeAt(i);
    // The `@` of a scope is dropped rather than replaced, so `@scope/hash`
    // reads as `scope_hash` and not as `_scope_hash`.
    if (code !== AT || i !== 0) {
      const plain =
        (code >= DIGIT_0 && code <= DIGIT_9) ||
        (code >= UPPER_A && code <= UPPER_Z) ||
        (code >= LOWER_A && code <= LOWER_Z) ||
        code === UNDERSCORE;
      out.addChar(plain ? code : UNDERSCORE);
    }
    i = i + 1;
  }
  const mangled = out.toText();
  // `2fast` would otherwise produce `@2fast.f`, which LLVM reads as a numbered
  // global, and a name that mangles away to nothing would produce `@.f`.
  const first = mangled.length === 0 ? DIGIT_0 : mangled.charCodeAt(0);
  if (first >= DIGIT_0 && first <= DIGIT_9) {
    return `_${mangled}.`;
  }
  return `${mangled}.`;
}
