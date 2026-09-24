// The one part of a `package.json` stage1 reads: which file a package offers an
// Nish consumer (WP21 S2, `src/manifest.ts` is the stage0 twin,
// `docs/wp21-packages.md` §2 and §6).
//
// A package says it is Nish by declaring the `nish` condition in its `exports`
// map, and its value is the **source** the consumer compiles:
//
//     { "exports": { ".": { "nish": "./src/index.ts", "import": "./dist/index.js" } } }
//
// Presence is the claim, which is what lets a bare import of an ordinary npm
// package fail saying the package has no Nish entry point rather than with a
// module-not-found that reads like the consumer's own mistake. Nothing else in
// the manifest is read: §6 talked the `--emit-manifest` sidecar out of
// existence on the rule that a fact the compiler can recompute is not metadata,
// and the mode is the one fact resolution has to know before the compiler can
// look, because it selects the file.
//
// **This is a reader, not a parser**, the same distinction `std/json` opens
// with, and the reason the stage0 twin is the same narrow scan rather than a
// `JSON.parse`: the two compilers have to select the same file for the same
// manifest, and a program that resolved under one and not the other would be a
// program that compiles with one compiler and not the other. What the narrowing
// costs is written down rather than left to be discovered:
//
//   - Only the `nish` conditions are honoured. `default`, `import`, `node` and
//     the rest are skipped, not matched — a package with `"default"` but no
//     `"nish"` has no Nish entry point, because a `default` target is
//     JavaScript and compiling it is not a thing this compiler can do.
//   - Subpath patterns (`"./*"`) are not matched; a subpath is an exact key.
//   - The mode-qualified condition wins over the plain one whatever order the
//     manifest declares them in, which is the one place this reader answers a
//     different file from the one Node's declaration-order matching would. The
//     reason is in `docs/wp21-packages.md` §6: `nish-f64` is not a rival of
//     `nish`, it is `nish` refined by the mode, and honouring the order would
//     mean that a package writing `nish` above `nish-f64` had mode-specific
//     source that is never compiled and no diagnostic saying so — the silent
//     ABI mismatch the condition exists to turn into a loud one.
//   - A target is a string beginning with `./`, with no `..` segment and no
//     backslash escape. Anything else — a nested condition object, an array of
//     targets, an escaped path — is treated as no target at all.
//   - The scan stops at the first thing it cannot read past — a missing comma,
//     a key that is not a string — and answers with what it found before it,
//     where Node refuses the whole manifest as malformed JSON. A mode-qualified
//     condition after such a break is therefore not seen, and the plain one
//     before it wins. Both compilers do the identical thing, which is what this
//     reader is for. When the scan finds nothing, `manifestMalformedAt` walks
//     the whole text and the failure names the break rather than the entry
//     point it hid (WP21 S3).
//
// `nishExportEntry` answers why a package has no file for a consumer as well as
// which file it has, so that each cause is its own diagnostic in `Compilation`
// (`docs/wp21-packages.md` §5c, §6): the package offers Nish only in the other
// number mode, it offers no Nish condition at all, or its manifest is not
// well-formed. What is left over — no `exports`, no such subpath, a shape this
// reader does not follow — is the one message S2 answered everything with. The
// `engines.nish` floor is read here too, and compared by `manifestEngineCheck`.
//
// Every helper below is `manifest`-prefixed, the way `std/json`'s are
// `json`-prefixed and for the same reason: a function name in `self/` shares one
// namespace with the rest of the compiler, so a helper called `stringValue` here
// is a name no other module can use — which the bootstrap found the moment this
// file arrived. The stage0 twin keeps the same names so the two stay diffable.

import { isDigit } from "./lexer";
import { splitByte } from "./strings";

const TAB: i32 = 9;
const NEWLINE: i32 = 10;
const CARRIAGE_RETURN: i32 = 13;
const SPACE: i32 = 32;
const QUOTE: i32 = 34;
const PLUS: i32 = 43;
const COMMA: i32 = 44;
const MINUS: i32 = 45;
const DOT: i32 = 46;
const SLASH: i32 = 47;
const DIGIT_ZERO: i32 = 48;
const COLON: i32 = 58;
const UPPER_E: i32 = 69;
const LOWER_A: i32 = 97;
const LOWER_Z: i32 = 122;
const BACKSLASH: i32 = 92;
const OPEN_BRACE: i32 = 123;
const CLOSE_BRACE: i32 = 125;
const OPEN_BRACKET: i32 = 91;
const CLOSE_BRACKET: i32 = 93;

/** The first index at or after `at` that is not JSON whitespace. */
const manifestSkipBlank = (text: string, at: i32): i32 => {
  let i = at;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code !== SPACE && code !== TAB && code !== NEWLINE && code !== CARRIAGE_RETURN) {
      return i;
    }
    i = i + 1;
  }
  return i;
};

/**
 * The index just past the string that starts at `at`, or -1 when it is not
 * closed. `\"` is stepped over so that a quote inside a string does not end it;
 * the escape is not decoded, which is why `manifestTarget` below refuses a target
 * that contains one.
 */
const manifestEndOfString = (text: string, at: i32): i32 => {
  let i = at + 1;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code === BACKSLASH) {
      i = i + 2;
    } else if (code === QUOTE) {
      return i + 1;
    } else {
      i = i + 1;
    }
  }
  return -1;
};

/**
 * The index just past the value that starts at `at`, or -1 when the text runs
 * out first. A nested object or array is stepped over rather than searched, so
 * the fields after it stay reachable.
 */
const manifestEndOfValue = (text: string, at: i32): i32 => {
  if (at >= text.length) {
    return -1;
  }
  const first = text.charCodeAt(at);
  if (first === QUOTE) {
    return manifestEndOfString(text, at);
  }
  if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
    let i = at;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (code === COMMA || code === CLOSE_BRACE || code === CLOSE_BRACKET) {
        return i;
      }
      if (code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN) {
        return i;
      }
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
      if (end < 0) {
        return -1;
      }
      i = end;
    } else {
      if (code === OPEN_BRACE || code === OPEN_BRACKET) {
        depth = depth + 1;
      } else if (code === CLOSE_BRACE || code === CLOSE_BRACKET) {
        depth = depth - 1;
        if (depth === 0) {
          return i + 1;
        }
      }
      i = i + 1;
    }
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
  if (i >= object.length || object.charCodeAt(i) !== OPEN_BRACE) {
    return "";
  }
  i = manifestSkipBlank(object, i + 1);
  while (i < object.length && object.charCodeAt(i) === QUOTE) {
    const keyEnd = manifestEndOfString(object, i);
    if (keyEnd < 0) {
      return "";
    }
    const key = object.substring(i + 1, keyEnd - 1);
    i = manifestSkipBlank(object, keyEnd);
    if (i >= object.length || object.charCodeAt(i) !== COLON) {
      return "";
    }
    const valueAt = manifestSkipBlank(object, i + 1);
    const valueEnd = manifestEndOfValue(object, valueAt);
    if (valueEnd < 0) {
      return "";
    }
    if (key === name) {
      return object.substring(valueAt, valueEnd);
    }
    i = manifestSkipBlank(object, valueEnd);
    if (i >= object.length || object.charCodeAt(i) !== COMMA) {
      return "";
    }
    i = manifestSkipBlank(object, i + 1);
  }
  return "";
};

/**
 * `raw` as an export target, or null when it is not one.
 *
 * The three refusals are the module header's list, and each is a resolution
 * failure rather than a silent fallback: a value that is not a quoted string is
 * a shape this reader does not understand (a nested condition object, or an
 * array of targets); a `\` is an escape it does not decode; and a target that
 * does not begin with `./`, or that climbs with `..`, is one Node itself
 * refuses, because an export must name a file inside the package.
 */
const manifestTarget = (raw: string): string | null => {
  if (raw.length < 2 || raw.charCodeAt(0) !== QUOTE) {
    return null;
  }
  const text = raw.substring(1, raw.length - 1);
  if (text.indexOf("\\") >= 0 || !text.startsWith("./")) {
    return null;
  }
  for (const segment of splitByte(text, SLASH)) {
    if (segment === "..") {
      return null;
    }
  }
  return text;
};

/** `nishExportEntry` found a file: `target` names it. */
export const MANIFEST_FOUND: i32 = 0;

/**
 * No file, for a reason none of the codes below names: no `exports`, no key
 * for the subpath, or a value this reader does not follow (an array of
 * targets, a nested condition object, an escaped or climbing path).
 */
export const MANIFEST_NO_FILE: i32 = 1;

/** The subpath's conditions offer only the *other* number mode's condition. */
export const MANIFEST_OTHER_MODE: i32 = 2;

/**
 * The subpath's entry offers no Nish condition in any spelling: a JavaScript
 * package, which is §6's `lodash` case.
 */
export const MANIFEST_NOT_NISH: i32 = 3;

/**
 * What `nishExportEntry` came away with: a status above, and the target when
 * the status is `MANIFEST_FOUND` (`""` otherwise). A class rather than a
 * nullable string because the failure has four shapes and each is its own
 * diagnostic.
 */
export class ManifestEntry {
  status: i32 = 0;
  target: string = "";

  constructor(status: i32, target: string) {
    this.status = status;
    this.target = target;
  }
}

/** `manifestHasKeyOrValue` asks for a key that begins with `.`. */
const SCAN_SUBPATH_KEY: i32 = 0;

/** `manifestHasKeyOrValue` asks for a value that is an object or an array. */
const SCAN_NESTED_VALUE: i32 = 1;

/**
 * Whether `object` has a key or a value of the kind `scan` names. A `.` key
 * makes it a subpath map rather than a condition map; a nested value is a
 * condition this reader does not follow, so a map that has one cannot be said
 * to declare no Nish condition — the `nish` row may be inside it.
 */
const manifestHasKeyOrValue = (object: string, scan: i32): boolean => {
  let i = manifestSkipBlank(object, 0);
  if (i < 0 || i >= object.length || object.charCodeAt(i) !== OPEN_BRACE) {
    return false;
  }
  i = manifestSkipBlank(object, i + 1);
  while (i >= 0 && i < object.length && object.charCodeAt(i) === QUOTE) {
    const keyEnd = manifestEndOfString(object, i);
    if (keyEnd < 0) {
      return false;
    }
    if (scan === SCAN_SUBPATH_KEY && object.substring(i + 1, keyEnd - 1).startsWith(".")) {
      return true;
    }
    i = manifestSkipBlank(object, keyEnd);
    if (i < 0 || i >= object.length || object.charCodeAt(i) !== COLON) {
      return false;
    }
    const valueAt = manifestSkipBlank(object, i + 1);
    if (scan === SCAN_NESTED_VALUE && valueAt >= 0 && valueAt < object.length) {
      const first = object.charCodeAt(valueAt);
      if (first === OPEN_BRACE || first === OPEN_BRACKET) {
        return true;
      }
    }
    const valueEnd = manifestEndOfValue(object, valueAt);
    if (valueEnd < 0) {
      return false;
    }
    i = manifestSkipBlank(object, valueEnd);
    if (i < 0 || i >= object.length || object.charCodeAt(i) !== COMMA) {
      return false;
    }
    i = manifestSkipBlank(object, i + 1);
  }
  return false;
};

/**
 * The file `manifest` offers for `subpath` under the Nish conditions, relative
 * to the package directory — or, when it offers none, which of the reasons
 * above it is.
 *
 * `primary` is the mode-qualified condition (`nish-f64`) and `fallback` the
 * plain one (`nish`), so a both-modes package matches either and a single-mode
 * package matches one — which is what makes a mode mismatch a resolution
 * failure at the boundary instead of a wrong answer at run time
 * (`docs/wp21-packages.md` §6, and the `bench/strbuild.ts` demonstration in it).
 * `other` is the mode-qualified condition of the mode this program is *not*
 * compiled in, and is only ever asked about to name the failure: a package
 * that offers it and neither of the other two supports the other mode only.
 *
 * The whole object is asked for `primary` before it is asked for `fallback`,
 * rather than both being asked for in one walk: the mode-qualified condition is
 * the plain one refined, so a manifest that declares `nish` above `nish-f64`
 * must not thereby make its own f64 source unreachable. That is the reader's
 * one deliberate departure from Node's declaration-order matching and the
 * module header says why. A `primary` key whose value is not a target — an
 * array, a nested object, an escaped path — answers no file here rather than
 * falling back to `fallback`, for the same reason: the package named a file for
 * this mode, and quietly compiling the other one is what this is avoiding.
 */
export const nishExportEntry = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string,
  other: string
): ManifestEntry => {
  const exports = manifestField(manifest, "exports");
  if (exports.length === 0) {
    return new ManifestEntry(MANIFEST_NO_FILE, "");
  }
  const forSubpath = manifestField(exports, subpath);
  // Node reads an `exports` object with no `.`-prefixed key as the condition
  // map for `.` itself, so `{"exports": {"nish": "./x.ts"}}` is the one-entry
  // shorthand for the example in the module header. Reaching it by "the subpath
  // was not a key" rather than by scanning for `.`-prefixed keys is one walk
  // instead of two, and differs from Node only for a manifest that mixes the
  // two forms, which Node refuses outright. The scan is paid only on the way
  // to a failure below, where a subpath map without `.` must not be reported
  // as a condition map that forgot its condition.
  let conditions = forSubpath;
  if (conditions.length === 0 && subpath === ".") {
    conditions = exports;
  }
  if (conditions.length === 0) {
    return new ManifestEntry(MANIFEST_NO_FILE, "");
  }
  let selected = manifestField(conditions, primary);
  if (selected.length === 0) {
    selected = manifestField(conditions, fallback);
  }
  if (selected.length > 0) {
    const target = manifestTarget(selected);
    return target === null ? new ManifestEntry(MANIFEST_NO_FILE, "") : new ManifestEntry(MANIFEST_FOUND, target);
  }
  if (forSubpath.length === 0 && manifestHasKeyOrValue(exports, SCAN_SUBPATH_KEY)) {
    return new ManifestEntry(MANIFEST_NO_FILE, "");
  }
  // A string where the conditions would be is a target with no condition on
  // it at all — `".": "./index.js"` — which is as JavaScript as a map of
  // `import` and `require` rows. An array is a fallback list this reader does
  // not follow, and stays the general answer.
  const first = conditions.charCodeAt(manifestSkipBlank(conditions, 0));
  if (first === QUOTE) {
    return new ManifestEntry(MANIFEST_NOT_NISH, "");
  }
  if (first !== OPEN_BRACE) {
    return new ManifestEntry(MANIFEST_NO_FILE, "");
  }
  if (manifestField(conditions, other).length > 0) {
    return new ManifestEntry(MANIFEST_OTHER_MODE, "");
  }
  // `{"node": {"nish": "./x.ts"}}` may well declare the condition, one level
  // down where this reader does not look, so it is not a claim that the
  // package has none.
  if (manifestHasKeyOrValue(conditions, SCAN_NESTED_VALUE)) {
    return new ManifestEntry(MANIFEST_NO_FILE, "");
  }
  return new ManifestEntry(MANIFEST_NOT_NISH, "");
};

/**
 * `nishExportEntry`'s file alone, or null when there is none: the question
 * `tests/self/support.ts` asks, whose answers are frozen from the S2 reader.
 */
export const nishExportTarget = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string
): string | null => {
  const entry = nishExportEntry(manifest, subpath, primary, fallback, "");
  return entry.status === MANIFEST_FOUND ? entry.target : null;
};

/** Nesting deeper than this is refused as unreadable, so a hostile manifest cannot exhaust the stack. */
const MANIFEST_DEPTH_LIMIT: i32 = 256;

/** Whether `code` may appear in a JSON number or in `true` / `false` / `null`. */
const manifestIsScalarByte = (code: i32): boolean =>
  isDigit(code) ||
  (code >= LOWER_A && code <= LOWER_Z) ||
  code === MINUS ||
  code === PLUS ||
  code === DOT ||
  code === UPPER_E;

/**
 * The index just past the JSON value at `at`, or `-1 - i` where `i` is the
 * byte this walk could not read past.
 *
 * Unlike `manifestEndOfValue`, which steps over a nested value to reach the
 * fields after it, this reads every byte, because its question is the one the
 * narrow scan never asks: whether the whole text is JSON. It is still a reader
 * rather than a parser — a scalar is any run of number and letter bytes that is
 * `true`, `false`, `null` or begins like a number — and it is asked only once
 * resolution has already failed.
 */
const manifestCheckValue = (text: string, at: i32, depth: i32): i32 => {
  const i = manifestSkipBlank(text, at);
  if (i >= text.length || depth > MANIFEST_DEPTH_LIMIT) {
    return -1 - i;
  }
  const first = text.charCodeAt(i);
  if (first === QUOTE) {
    const end = manifestEndOfString(text, i);
    return end < 0 ? -1 - i : end;
  }
  if (first === OPEN_BRACE || first === OPEN_BRACKET) {
    const close = first === OPEN_BRACE ? CLOSE_BRACE : CLOSE_BRACKET;
    let j = manifestSkipBlank(text, i + 1);
    if (j < text.length && text.charCodeAt(j) === close) {
      return j + 1;
    }
    while (j >= 0 && j < text.length) {
      if (first === OPEN_BRACE) {
        if (text.charCodeAt(j) !== QUOTE) {
          return -1 - j;
        }
        const keyEnd = manifestEndOfString(text, j);
        if (keyEnd < 0) {
          return -1 - j;
        }
        j = manifestSkipBlank(text, keyEnd);
        if (j < 0 || j >= text.length || text.charCodeAt(j) !== COLON) {
          return -1 - j;
        }
        j = j + 1;
      }
      const end = manifestCheckValue(text, j, depth + 1);
      if (end < 0) {
        return end;
      }
      j = manifestSkipBlank(text, end);
      if (j < 0 || j >= text.length) {
        return -1 - j;
      }
      const next = text.charCodeAt(j);
      if (next === close) {
        return j + 1;
      }
      if (next !== COMMA) {
        return -1 - j;
      }
      j = manifestSkipBlank(text, j + 1);
    }
    return -1 - j;
  }
  let j = i;
  while (j >= 0 && j < text.length && manifestIsScalarByte(text.charCodeAt(j))) {
    j = j + 1;
  }
  const word = text.substring(i, j);
  const numeric = first === MINUS || isDigit(first);
  if (j === i || (!numeric && word !== "true" && word !== "false" && word !== "null")) {
    return -1 - i;
  }
  return j;
};

/**
 * The byte offset at which `manifest` stops being JSON, or -1 when all of it
 * is. Whitespace after the top-level value is allowed and anything else is
 * not, so a second object pasted below the first is a break at its brace.
 */
export const manifestMalformedAt = (manifest: string): i32 => {
  const end = manifestCheckValue(manifest, 0, 0);
  if (end < 0) {
    return -1 - end;
  }
  const rest = manifestSkipBlank(manifest, end);
  return rest < manifest.length ? rest : -1;
};

/** `engines.<condition>` is absent, or a floor this compiler meets. */
export const ENGINE_OK: i32 = 0;

/** `engines.<condition>` is a floor above this compiler's version. */
export const ENGINE_TOO_OLD: i32 = 1;

/** `engines.<condition>` is present and is not a range this reader accepts. */
export const ENGINE_UNREADABLE: i32 = 2;

/**
 * The text of `engines.<condition>`, unquoted when it is a string and as
 * written when it is not, or `""` when the manifest declares none. This is
 * what a diagnostic quotes back to the package's author.
 */
export const manifestEngineRange = (manifest: string, condition: string): string => {
  const raw = manifestField(manifestField(manifest, "engines"), condition);
  if (raw.length >= 2 && raw.charCodeAt(0) === QUOTE) {
    return raw.substring(1, raw.length - 1);
  }
  return raw;
};

/**
 * The manifest's `version`, unquoted when it is a string and as written when
 * it is not, or `""` when it declares none. A diagnostic that names two copies
 * of one package tells them apart by it.
 */
export const manifestVersion = (manifest: string): string => {
  const raw = manifestField(manifest, "version");
  if (raw.length >= 2 && raw.charCodeAt(0) === QUOTE) {
    return raw.substring(1, raw.length - 1);
  }
  return raw;
};

/**
 * The run of digits of `text` at `at` as a number, and the index after it
 * through `next`, a one-element array because the language has no tuple. -1
 * when there is no digit, or more than nine: a version component that does not
 * fit an `i32` is not one anybody has published.
 */
const manifestReadNumber = (text: string, at: i32, next: i32[]): i32 => {
  let i = at;
  let value = 0;
  while (i >= 0 && i < text.length) {
    const code = text.charCodeAt(i);
    if (!isDigit(code)) {
      break;
    }
    if (i - at >= 9) {
      return -1;
    }
    value = value * 10 + (code - DIGIT_ZERO);
    i = i + 1;
  }
  next[0] = i;
  return i === at ? -1 : value;
};

/**
 * The `X.Y` or `X.Y.Z` at `at` in `text` as `[major, minor, patch]`, a missing
 * patch read as 0, with the index after it through `next`; empty when there is
 * no such version there. What follows it is the caller's to judge.
 */
const manifestVersionParts = (text: string, at: i32, next: i32[]): i32[] => {
  const parts: i32[] = [];
  let i = at;
  while (parts.length < 3) {
    const value = manifestReadNumber(text, i, next);
    if (value < 0) {
      const none: i32[] = [];
      return none;
    }
    parts.push(value);
    i = next[0];
    if (parts.length === 3 || i < 0 || i >= text.length || i + 1 >= text.length) {
      break;
    }
    if (text.charCodeAt(i) !== DOT) {
      break;
    }
    i = i + 1;
  }
  if (parts.length < 2) {
    const none: i32[] = [];
    return none;
  }
  if (parts.length === 2) {
    parts.push(0);
  }
  next[0] = i;
  return parts;
};

/**
 * Whether `version` meets the floor `manifest` declares in
 * `engines.<condition>` (`docs/wp21-packages.md` §6, the slot npm already has
 * for exactly this).
 *
 * The one range accepted is a floor, `>=X.Y.Z` or `>=X.Y`, with blanks allowed
 * around the version; every other shape — a caret, a tilde, an upper bound, a
 * `||`, a bare version, a value that is not a string — is `ENGINE_UNREADABLE`
 * and never treated as satisfied, because a floor this compiler cannot read is
 * a floor it cannot claim to meet.
 */
export const manifestEngineCheck = (manifest: string, condition: string, version: string): i32 => {
  const raw = manifestField(manifestField(manifest, "engines"), condition);
  if (raw.length === 0) {
    return ENGINE_OK;
  }
  if (raw.charCodeAt(0) !== QUOTE) {
    return ENGINE_UNREADABLE;
  }
  const range = raw.substring(1, raw.length - 1);
  const next: i32[] = [0];
  const opAt = manifestSkipBlank(range, 0);
  if (!range.substring(opAt, range.length).startsWith(">=")) {
    return ENGINE_UNREADABLE;
  }
  const floor = manifestVersionParts(range, manifestSkipBlank(range, opAt + 2), next);
  if (floor.length === 0 || manifestSkipBlank(range, next[0]) < range.length) {
    return ENGINE_UNREADABLE;
  }
  // This compiler's own version may carry a prerelease tag after its third
  // number, which is ignored: `0.9.0-rc.1` meets a floor of `>=0.9`.
  const running = manifestVersionParts(version, 0, next);
  if (running.length === 0) {
    return ENGINE_UNREADABLE;
  }
  let i = 0;
  while (i < 3 && i < running.length && i < floor.length) {
    if (running[i] > floor[i]) {
      return ENGINE_OK;
    }
    if (running[i] < floor[i]) {
      return ENGINE_TOO_OLD;
    }
    i = i + 1;
  }
  return ENGINE_OK;
};
