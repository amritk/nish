/**
 * Package-scoped symbols (WP21 S1, `docs/wp21-packages.md` §5a).
 *
 * The whole-program fact fixpoint in `codegen/attributes.ts` is keyed by the
 * symbol a function is emitted under, so until now a symbol *was* a bare name
 * and two packages that each kept a private `helper()` could not be compiled
 * into one program: whichever was collected second would have been handed the
 * first one's purity, escape and pointer facts. That is a miscompile rather
 * than a link error, which is why `Compilation.rejectSymbolClashes` refuses it
 * outright and why it has to be fixed before a package ecosystem is possible.
 *
 * The fix is to give every symbol a package scope. A module belongs to exactly
 * one package, the symbols it declares are qualified with that package's
 * prefix, and the fact table is keyed by the qualified symbol — so a name is
 * never a key again, a *package-scoped symbol* is.
 *
 * **The root package's prefix is empty.** That is the whole of why this stage
 * moves no IR: a program compiled today is one package — its own — so every
 * symbol it emits is spelled exactly as it was before, every golden `.ll` is
 * byte-identical, and every exported name keeps the C ABI it had. A prefix
 * appears only where a second package does, which is a program that could not
 * be compiled at all until now.
 *
 * **How a module says which package it is in.** It does not: the path says it.
 * A module under `<...>/node_modules/<name>/` (or `<...>/node_modules/@scope/<name>/`)
 * belongs to package `<name>` / `@scope/<name>`; everything sharing the entry's
 * own package directory — which for an ordinary program is "no package
 * directory at all" — is the root package. That rule needs no manifest, no
 * resolver and no new flag, it reads only the module name the compiler already
 * carries, and it is exactly the layout the bare-specifier resolution of
 * WP21 S2 produces.
 *
 * **What WP21 S2 changed, and what it deliberately left.** A module reached by
 * a *bare* specifier no longer has its package read off its path: the resolver
 * states it, because the resolver is the thing that knows — it found the
 * manifest that made the directory a package. What still reads a path is a
 * module reached any other way, which is a relative import that happens to
 * point into `node_modules` (`tests/link/two_packages`) and every module inside
 * a package, whose own relative imports are its own package's. The two rules
 * agree wherever both apply, which is what §9b predicted: the path rule is the
 * layout bare resolution produces. So the placeholder shrank to the cases the
 * resolver is never asked about, rather than disappearing.
 *
 * TODO(WP21 S7): two packages that declare the same class or interface name
 * still collide, because a struct's identity is its name program-wide
 * (`%struct.<name>`, and `StaticType` equality). `Compilation` reports that in
 * those words now; deciding what a `Point` from two versions of one package
 * means is §7's question, not this stage's.
 */

/** The package every ordinary program is: no prefix, so no symbol moves. */
export const ROOT_PACKAGE = "";

/** The directory segment that introduces a package, as npm lays one out. */
export const PACKAGE_ROOT_SEGMENT = "node_modules";

/** Windows and POSIX alike: a module name reaches here in either spelling. */
const segmentsOf = (modulePath: string): string[] => modulePath.split(/[\\/]/);

const AT = 64;
const UNDERSCORE = 95;
const DIGIT_0 = 48;
const DIGIT_9 = 57;
const UPPER_A = 65;
const UPPER_Z = 90;
const LOWER_A = 97;
const LOWER_Z = 122;

/**
 * Where the innermost `node_modules` of a path is, or -1 when it has none. The
 * *innermost* one, because a dependency's own `node_modules` holds its own
 * dependencies: the last one on the path is the one that owns the file.
 */
const packageRootAt = (segments: readonly string[]): number => {
  let at = -1;
  for (let i = 0; i + 1 < segments.length; i++) {
    if (segments[i] === PACKAGE_ROOT_SEGMENT && segments[i + 1].length > 0) at = i;
  }
  return at;
};

/** How many leading segments make up the package root, or 0 for no package. */
const packageRootLength = (segments: readonly string[], at: number): number => {
  if (at < 0) return 0;
  // `@scope/name` is two segments and one package name.
  return segments[at + 1].startsWith("@") && at + 2 < segments.length ? at + 3 : at + 2;
};

/** `segments[from..to)` joined with `/`. */
const joinSegments = (segments: readonly string[], from: number, to: number): string => {
  let out = "";
  for (let i = from; i < to; i++) out = i === from ? segments[i] : `${out}/${segments[i]}`;
  return out;
};

/**
 * The package directory a module lives in, or `""` when it is in none. Two
 * modules are in the same package exactly when this answers the same string
 * for both, which is the comparison `Compilation` makes against the entry:
 * comparing *directories* rather than names is what keeps a compiler invoked
 * from inside `node_modules/<pkg>` from deciding that its own entry is a
 * dependency of itself.
 */
export const packageDirOf = (modulePath: string): string => {
  const segments = segmentsOf(modulePath);
  const length = packageRootLength(segments, packageRootAt(segments));
  return length === 0 ? "" : joinSegments(segments, 0, length);
};

/** The package a module belongs to (`hash`, `@scope/hash`), or `""` for none. */
export const packageNameOf = (modulePath: string): string => {
  const segments = segmentsOf(modulePath);
  const at = packageRootAt(segments);
  const length = packageRootLength(segments, at);
  return length === 0 ? ROOT_PACKAGE : joinSegments(segments, at + 1, length);
};

/**
 * The prefix every symbol of `packageName` carries: `""` for the root package,
 * and otherwise the name reduced to the characters an LLVM symbol and a C
 * identifier can both hold, with a `.` separator — the one methods already use
 * (`Point.shifted`), so `--emit-header` keeps declaring such a symbol the way
 * it has always declared a method: as `hash_helper` with an asm label.
 *
 * The mangling is not injective (`@scope/hash` and `scope_hash` reduce to the
 * same prefix). It does not have to be: `rejectSymbolClashes` runs over the
 * *qualified* symbols, so two packages that reduce to one prefix are refused
 * with a name in the message rather than silently sharing a fact table.
 */
export const packageSymbolPrefix = (packageName: string): string => {
  if (packageName === ROOT_PACKAGE) return "";
  let mangled = "";
  for (let i = 0; i < packageName.length; i++) {
    const code = packageName.charCodeAt(i);
    // The `@` of a scope is dropped rather than replaced, so `@scope/hash`
    // reads as `scope_hash` and not as `_scope_hash`.
    if (code === AT && i === 0) continue;
    const plain =
      (code >= DIGIT_0 && code <= DIGIT_9) ||
      (code >= UPPER_A && code <= UPPER_Z) ||
      (code >= LOWER_A && code <= LOWER_Z) ||
      code === UNDERSCORE;
    mangled = mangled + (plain ? packageName[i] : "_");
  }
  // `2fast` would otherwise produce `@2fast.f`, which LLVM reads as a numbered
  // global, and a name that mangles away to nothing would produce `@.f`.
  const first = mangled.length === 0 ? DIGIT_0 : mangled.charCodeAt(0);
  return `${first >= DIGIT_0 && first <= DIGIT_9 ? `_${mangled}` : mangled}.`;
};

/**
 * A bare import specifier taken apart (WP21 S2): `@scope/hash/blake3` is the
 * package `@scope/hash` and the `exports` subpath `./blake3`.
 *
 * The subpath is spelled the way the manifest spells it — `.` for the package
 * itself and `./x` for anything under it — so that it is the key looked up in
 * the `exports` map with no further shaping.
 */
export type BareSpecifier = {
  /** `hash`, `@scope/hash`. */
  name: string;
  /** `.` or `./blake3`: the key in the package's `exports` map. */
  subpath: string;
};

/** `/`, `\` and `:` are what separates a package name from a path or a URL. */
const isNameSegment = (segment: string): boolean =>
  segment.length > 0 && !segment.startsWith(".") && segment.indexOf("\\") < 0 && segment.indexOf(":") < 0;

/**
 * `specifier` as a package name and subpath, or `null` when it is not a package
 * specifier at all.
 *
 * Refused: an empty specifier, one that begins with `.` (that is a relative
 * import and is resolved as one) or with `/` (an absolute path, which is a
 * thing about the machine rather than about the program), a scope with no name
 * after it, a trailing slash, any segment that begins with a `.` (which is what
 * rules out a `..` climbing out of the package), and any `\` or `:` — the last
 * being what keeps `node:fs` and `http://x` from reading as package names.
 *
 * Deliberately *not* checked: whether the name is one npm would accept today.
 * npm's own rules have changed and the registry still holds names that no
 * longer pass them, so a name this compiler cannot resolve should fail by not
 * being on disk, which names the package, rather than by a spelling rule, which
 * would be this compiler inventing a registry policy (§7: the resolver is
 * Node's algorithm, and the registry is npm's problem).
 */
export const parseBareSpecifier = (specifier: string): BareSpecifier | null => {
  const segments = specifier.split("/");
  const scoped = specifier.startsWith("@");
  const nameLength = scoped ? 2 : 1;
  if (segments.length < nameLength) return null;
  for (let i = 0; i < segments.length; i++) {
    // The scope's `@` is stripped before the check, so `@scope` is a name
    // segment and a bare `@` is not.
    if (!isNameSegment(i === 0 && scoped ? segments[0].slice(1) : segments[i])) return null;
  }
  const rest = joinSegments(segments, nameLength, segments.length);
  return {
    name: joinSegments(segments, 0, nameLength),
    subpath: rest.length === 0 ? "." : `./${rest}`,
  };
};
