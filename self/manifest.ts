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
//   - A target is a string beginning with `./`, with no `..` segment and no
//     backslash escape. Anything else — a nested condition object, an array of
//     targets, an escaped path — is treated as no target at all.
//
// Each of those answers null here and becomes one diagnostic in `Compilation`.
// TODO(WP21 S3): §5c and §6 want that one message split into the specific ones —
// a mode mismatch naming both modes, a version floor from `engines.nish` — which
// is the boundary-diagnostics stage and not this one.
//
// Every helper below is `manifest`-prefixed, the way `std/json`'s are
// `json`-prefixed and for the same reason: a function name in `self/` shares one
// namespace with the rest of the compiler, so a helper called `stringValue` here
// is a name no other module can use — which the bootstrap found the moment this
// file arrived. The stage0 twin keeps the same names so the two stay diffable.

import { splitByte } from "./strings";

const TAB: i32 = 9;
const NEWLINE: i32 = 10;
const CARRIAGE_RETURN: i32 = 13;
const SPACE: i32 = 32;
const QUOTE: i32 = 34;
const COMMA: i32 = 44;
const SLASH: i32 = 47;
const COLON: i32 = 58;
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
 * The raw text of the value of the first key of `object` that is `first` or
 * `second`, in the object's own declaration order, or `""` when it has neither.
 *
 * Declaration order is the whole of how a condition is selected: Node takes the
 * first key of the object that the consumer asked for, so
 * `{"nish": "a", "nish-f64": "b"}` answers `a` in f64 mode and
 * `{"nish-f64": "b", "nish": "a"}` answers `b`. Passing the two condition names
 * to one walk is what makes that order the object's rather than ours.
 *
 * A key that carries a backslash escape is compared as written and so matches
 * nothing, which is the narrowing the module header states.
 */
const manifestFirstField = (object: string, first: string, second: string): string => {
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
    if (key === first || key === second) {
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

/** The raw text of `object`'s `name` field, or `""` when it has none. */
const manifestField = (object: string, name: string): string => manifestFirstField(object, name, name);

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

/**
 * The file `manifest` offers for `subpath` under the Nish conditions, relative
 * to the package directory, or null when it offers none.
 *
 * `primary` is the mode-qualified condition (`nish-f64`) and `fallback` the
 * plain one (`nish`), so a both-modes package matches either and a single-mode
 * package matches one — which is what makes a mode mismatch a resolution
 * failure at the boundary instead of a wrong answer at run time
 * (`docs/wp21-packages.md` §6, and the `bench/strbuild.ts` demonstration in it).
 */
export const nishExportTarget = (
  manifest: string,
  subpath: string,
  primary: string,
  fallback: string
): string | null => {
  const exports = manifestField(manifest, "exports");
  if (exports.length === 0) {
    return null;
  }
  const forSubpath = manifestField(exports, subpath);
  // Node reads an `exports` object with no `.`-prefixed key as the condition
  // map for `.` itself, so `{"exports": {"nish": "./x.ts"}}` is the one-entry
  // shorthand for the example in the module header. Reaching it by "the subpath
  // was not a key" rather than by scanning for `.`-prefixed keys is one walk
  // instead of two, and differs from Node only for a manifest that mixes the
  // two forms, which Node refuses outright.
  let conditions = forSubpath;
  if (conditions.length === 0 && subpath === ".") {
    conditions = exports;
  }
  if (conditions.length === 0) {
    return null;
  }
  return manifestTarget(manifestFirstField(conditions, primary, fallback));
};
