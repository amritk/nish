/**
 * The one part of a `package.json` this compiler reads: which file a package
 * offers an Nish consumer (WP21 S2, `docs/wp21-packages.md` §2 and §6).
 *
 * A package says it is Nish by declaring the `nish` condition in its `exports`
 * map, and its value is the **source** the consumer compiles:
 *
 * ```jsonc
 * { "exports": { ".": { "nish": "./src/index.ts", "import": "./dist/index.js" } } }
 * ```
 *
 * Presence is the claim, which is what lets a bare import of an ordinary npm
 * package fail saying the package has no Nish entry point rather than with a
 * module-not-found that reads like the consumer's own mistake. Nothing else in
 * the manifest is read: §6 talked the `--emit-manifest` sidecar out of
 * existence on the rule that *a fact the compiler can recompute is not
 * metadata*, and the mode is the one fact resolution has to know before the
 * compiler can look, because it selects the file.
 *
 * **This is a reader, not a parser**, the same distinction `std/json` opens
 * with and for a stronger reason: stage1 has no `JSON.parse` and the two
 * compilers must select the same file for the same manifest, so `src/` reads
 * the bytes with the same narrow scan `self/manifest.ts` does rather than
 * delegating to a parser stage1 cannot have. What that costs is written down
 * rather than left to be discovered:
 *
 *   - Only the `nish` conditions are honoured. `default`, `import`, `node` and
 *     the rest are *skipped*, not matched — a package with `"default"` but no
 *     `"nish"` has no Nish entry point, because a `default` target is JavaScript
 *     and compiling it is not a thing this compiler can do.
 *   - Subpath **patterns** (`"./*"`) are not matched; a subpath is an exact key.
 *   - The mode-qualified condition wins over the plain one **whatever order the
 *     manifest declares them in**, which is the one place this reader answers a
 *     different file from the one Node's declaration-order matching would. The
 *     reason is in `docs/wp21-packages.md` §6: `nish-f64` is not a rival of
 *     `nish`, it is `nish` refined by the mode, and honouring the order would
 *     mean that a package writing `nish` above `nish-f64` had mode-specific
 *     source that is never compiled and no diagnostic saying so — the silent
 *     ABI mismatch the condition exists to turn into a loud one.
 *   - A target is a string beginning with `./`, with no `..` segment and no
 *     backslash escape. Anything else — a nested condition object, an array of
 *     targets, an escaped path — is treated as no target at all.
 *
 * Each of those answers `null` here and becomes one diagnostic in
 * `Compilation`. TODO(WP21 S3): §5c and §6 want that one message split into the
 * specific ones — a mode mismatch naming both modes, a version floor from
 * `engines.nish` — which is the boundary-diagnostics stage and not this one.
 *
 * Every helper below is `manifest`-prefixed, the way `std/json`'s are
 * `json`-prefixed and for the same reason: stage1's twin of this module is an
 * Nish program whose function names share one namespace with the rest of
 * `self/`, so a helper called `stringValue` here is a name no other module of
 * the compiler can use. The two files keep the same names so that they stay
 * diffable.
 */

const TAB = 9;
const NEWLINE = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const QUOTE = 34;
const COMMA = 44;
const COLON = 58;
const BACKSLASH = 92;
const OPEN_BRACE = 123;
const CLOSE_BRACE = 125;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;

/** The first index at or after `at` that is not JSON whitespace. */
const manifestSkipBlank = (text: string, at: number): number => {
  let i = at;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code !== SPACE && code !== TAB && code !== NEWLINE && code !== CARRIAGE_RETURN) return i;
    i = i + 1;
  }
  return i;
};

/**
 * The index just past the string that starts at `at`, or -1 when it is not
 * closed. `\"` is stepped over so that a quote inside a string does not end it;
 * the escape is not *decoded*, which is why `manifestTarget` below refuses a
 * target that contains one.
 */
const manifestEndOfString = (text: string, at: number): number => {
  let i = at + 1;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === BACKSLASH) i = i + 2;
    else if (code === QUOTE) return i + 1;
    else i = i + 1;
  }
  return -1;
};

/**
 * The index just past the value that starts at `at`, or -1 when the text runs
 * out first. A nested object or array is stepped over rather than searched, so
 * the fields after it stay reachable.
 */
const manifestEndOfValue = (text: string, at: number): number => {
  if (at >= text.length) return -1;
  const first = text.charCodeAt(at);
  if (first === QUOTE) return manifestEndOfString(text, at);
  if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
    let i = at;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (code === COMMA || code === CLOSE_BRACE || code === CLOSE_BRACKET) return i;
      if (code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN) return i;
      i = i + 1;
    }
    return i;
  }
  let depth = 0;
  let i = at;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === QUOTE) {
      const end = manifestEndOfString(text, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (code === OPEN_BRACE || code === OPEN_BRACKET) depth = depth + 1;
    else if (code === CLOSE_BRACE || code === CLOSE_BRACKET) {
      depth = depth - 1;
      if (depth === 0) return i + 1;
    }
    i = i + 1;
  }
  return -1;
};

/**
 * The raw text of `object`'s `name` field, or `""` when it has none.
 *
 * A key that carries a backslash escape is compared as written and so matches
 * nothing, which is the narrowing the module header states.
 */
const manifestField = (object: string, name: string): string => {
  let i = manifestSkipBlank(object, 0);
  if (i >= object.length || object.charCodeAt(i) !== OPEN_BRACE) return "";
  i = manifestSkipBlank(object, i + 1);
  while (i < object.length && object.charCodeAt(i) === QUOTE) {
    const keyEnd = manifestEndOfString(object, i);
    if (keyEnd < 0) return "";
    const key = object.substring(i + 1, keyEnd - 1);
    i = manifestSkipBlank(object, keyEnd);
    if (i >= object.length || object.charCodeAt(i) !== COLON) return "";
    const valueAt = manifestSkipBlank(object, i + 1);
    const valueEnd = manifestEndOfValue(object, valueAt);
    if (valueEnd < 0) return "";
    if (key === name) return object.substring(valueAt, valueEnd);
    i = manifestSkipBlank(object, valueEnd);
    if (i >= object.length || object.charCodeAt(i) !== COMMA) return "";
    i = manifestSkipBlank(object, i + 1);
  }
  return "";
};

/**
 * `raw` as an export target, or `null` when it is not one.
 *
 * The three refusals are the module header's list, and each is a *resolution*
 * failure rather than a silent fallback: a value that is not a quoted string is
 * a shape this reader does not understand (a nested condition object, or an
 * array of targets); a `\` is an escape it does not decode; and a target that
 * does not begin with `./`, or that climbs with `..`, is one Node itself
 * refuses, because an export must name a file inside the package.
 */
const manifestTarget = (raw: string): string | null => {
  if (raw.length < 2 || raw.charCodeAt(0) !== QUOTE) return null;
  const text = raw.substring(1, raw.length - 1);
  if (text.indexOf("\\") >= 0 || !text.startsWith("./")) return null;
  for (const segment of text.split("/")) {
    if (segment === "..") return null;
  }
  return text;
};

/**
 * The file `manifest` offers for `subpath` under the Nish conditions, relative
 * to the package directory, or `null` when it offers none.
 *
 * `primary` is the mode-qualified condition (`nish-f64`) and `fallback` the
 * plain one (`nish`), so a both-modes package matches either and a single-mode
 * package matches one — which is what makes a mode mismatch a resolution
 * failure at the boundary instead of a wrong answer at run time
 * (`docs/wp21-packages.md` §6, and the `bench/strbuild.ts` demonstration in it).
 *
 * The whole object is asked for `primary` before it is asked for `fallback`,
 * rather than both being asked for in one walk: the mode-qualified condition is
 * the plain one *refined*, so a manifest that declares `nish` above `nish-f64`
 * must not thereby make its own f64 source unreachable. That is the reader's
 * one deliberate departure from Node's declaration-order matching and the
 * module header says why. A `primary` key whose value is not a target — an
 * array, a nested object, an escaped path — answers `null` here rather than
 * falling back to `fallback`, for the same reason: the package named a file for
 * this mode, and quietly compiling the other one is what this is avoiding.
 */
export const nishExportTarget = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string
): string | null => {
  const exports = manifestField(manifest, "exports");
  if (exports.length === 0) return null;
  const forSubpath = manifestField(exports, subpath);
  // Node reads an `exports` object with no `.`-prefixed key as the condition
  // map for `.` itself, so `{"exports": {"nish": "./x.ts"}}` is the one-entry
  // shorthand for the example in the module header. Reaching it by "the subpath
  // was not a key" rather than by scanning for `.`-prefixed keys is one walk
  // instead of two, and differs from Node only for a manifest that mixes the
  // two forms, which Node refuses outright.
  const conditions = forSubpath.length > 0 ? forSubpath : subpath === "." ? exports : "";
  if (conditions.length === 0) return null;
  const qualified = manifestField(conditions, primary);
  return manifestTarget(qualified.length > 0 ? qualified : manifestField(conditions, fallback));
};
