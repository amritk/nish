// Path normalisation, which docs/wp14-selfhost.md §3a D3 flags as a real
// hazard rather than tedium: **module identity is the resolved path**. A
// `resolve` that normalises `..` differently from Node's loads one file
// twice, stops import cycles terminating, and invents duplicate-symbol
// errors — three failures that all look like a checker bug and none of which
// is one. So this file matches `node:path`'s POSIX behaviour exactly, and
// `tests/self/support_oracle.js` compares it with `path.posix` over the
// awkward cases rather than trusting the reading.
//
// POSIX only: `self/` is built and tested on Linux and macOS, and a backslash
// is an ordinary character in a file name on both.

import { splitByte, StringBuilder } from "./strings";

const SLASH: i32 = 47; // '/'
const DOT: i32 = 46; // '.'

function isAbsolutePath(p: string): boolean {
  return p.length > 0 && p.charCodeAt(0) === SLASH;
}

/**
 * `p` split on `/` with the empty pieces dropped, so `//a//b/` gives
 * `["a", "b"]` and the caller reads "absolute" off the first byte instead of
 * off a leading empty segment.
 */
function splitSegments(p: string): string[] {
  const parts: string[] = [];
  for (const part of splitByte(p, SLASH)) {
    if (part.length > 0) {
      parts.push(part);
    }
  }
  return parts;
}

/** Whether `segment` is exactly `..`. */
function isParent(segment: string): boolean {
  return segment.length === 2 && segment.charCodeAt(0) === DOT && segment.charCodeAt(1) === DOT;
}

/** Whether `segment` is exactly `.`. */
function isHere(segment: string): boolean {
  return segment.length === 1 && segment.charCodeAt(0) === DOT;
}

/**
 * `path.posix.normalize` for a path with no trailing slash to preserve:
 * `.` segments vanish, `..` pops the segment before it, and a `..` with
 * nothing to pop survives in a relative path and is dropped in an absolute
 * one (you cannot go above `/`). The empty result is `/` when absolute and
 * `.` when not, as Node's is.
 */
export function normalizePath(p: string): string {
  const absolute = isAbsolutePath(p);
  const out: string[] = [];
  for (const segment of splitSegments(p)) {
    if (isHere(segment)) {
      continue;
    }
    if (!isParent(segment)) {
      out.push(segment);
      continue;
    }
    if (out.length > 0 && !isParent(out[out.length - 1])) {
      out.pop();
    } else if (!absolute) {
      out.push(segment);
    }
  }
  const joined = out.join("/");
  if (absolute) {
    return `/${joined}`;
  }
  return joined.length === 0 ? "." : joined;
}

/**
 * `path.posix.resolve(base, spec)` for an already-resolved `base`: an
 * absolute `spec` wins outright, otherwise it is taken relative to `base`.
 *
 * Unlike Node's there is no fall back to the working directory, because
 * StaticTS has no `process.cwd()` — stage1 keys module identity on the
 * normalised path as written, which agrees with stage0's absolute paths for
 * every program whose inputs are named the same way (D4: stage1 emits `.ll`
 * and a wrapper links).
 */
export function resolvePath(base: string, spec: string): string {
  if (isAbsolutePath(spec)) {
    return normalizePath(spec);
  }
  if (base.length === 0) {
    return normalizePath(spec);
  }
  return normalizePath(`${base}/${spec}`);
}

/**
 * `path.posix.dirname`: trailing slashes ignored, then everything before the
 * last `/`. Node's three edge cases come with it — no slash at all is `.`,
 * the root is `/`, and an interior run of slashes is **not** collapsed, so
 * `dirname("/a//b")` is `"/a/"`. That last one looks like a bug to fix and is
 * not: normalising here would make this disagree with the `path.posix` the
 * oracle compares it against, and every path that becomes a module identity
 * goes through `normalizePath` anyway.
 */
export function dirname(p: string): string {
  const absolute = isAbsolutePath(p);
  let end = p.length;
  while (end > 0 && p.charCodeAt(end - 1) === SLASH) {
    end = end - 1;
  }
  let cut = -1;
  let i = end - 1;
  while (i >= 0) {
    if (p.charCodeAt(i) === SLASH) {
      cut = i;
      i = -1;
    } else {
      i = i - 1;
    }
  }
  if (cut < 0) {
    return absolute ? "/" : ".";
  }
  return cut === 0 ? "/" : p.substring(0, cut);
}

/** `path.posix.basename`: everything after the last `/`, trailing slashes ignored. */
export function basename(p: string): string {
  let end = p.length;
  while (end > 0 && p.charCodeAt(end - 1) === SLASH) {
    end = end - 1;
  }
  let start = 0;
  let i = end - 1;
  while (i >= 0) {
    if (p.charCodeAt(i) === SLASH) {
      start = i + 1;
      i = -1;
    } else {
      i = i - 1;
    }
  }
  return p.substring(start, end);
}

/**
 * `basename(p)` without `suffix`, when it ends with it and something is left.
 *
 * Deliberately **not** `path.posix.basename(p, ext)`, whose corners are
 * artifacts of its implementation rather than a rule: it answers `"///"` for
 * `basename("///", ".ts")`, and `""` for `basename(".ts", ".ts")` while
 * answering `".ts"` for `basename("x/.ts", ".ts")`. What a compiler wants
 * from this is a module's name, so a basename that is nothing but the suffix
 * keeps it.
 */
export function basenameWithout(p: string, suffix: string): string {
  const name = basename(p);
  if (suffix.length > 0 && suffix.length < name.length && name.endsWith(suffix)) {
    return name.substring(0, name.length - suffix.length);
  }
  return name;
}

/**
 * The file a module specifier names: `./x` and `./x.js` both mean `x.ts`,
 * which is `src/compilation.ts`'s rule (TypeScript's ESM convention) written
 * out. The result is the module's identity, so it goes through `resolvePath`.
 */
export function resolveModule(importerDir: string, specifier: string): string {
  const resolved = resolvePath(importerDir, specifier);
  if (resolved.endsWith(".js")) {
    return `${resolved.substring(0, resolved.length - 3)}.ts`;
  }
  if (resolved.endsWith(".ts")) {
    return resolved;
  }
  return `${resolved}.ts`;
}

/**
 * `path.posix.relative(from, to)` for two paths **rooted at the same base**:
 * both relative, or both absolute, and neither climbing above that base. That
 * is the contract, and it is not a simplification of Node's function so much
 * as the only part of it that is well defined without a working directory —
 * `path.posix.relative` resolves its arguments against `process.cwd()` first,
 * and stage1 has none (docs/wp14-selfhost.md §3a D4).
 *
 * Inside the contract the answers are identical, which is what
 * `tests/self/support_oracle.js` checks: the common prefix of segments is
 * dropped, one `..` is emitted per segment left in `from`, and the rest of
 * `to` follows.
 */
export function relativePath(from: string, to: string): string {
  const fromParts = pathSegments(normalizePath(from));
  const toParts = pathSegments(normalizePath(to));
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common = common + 1;
  }
  const out: string[] = [];
  let i = common;
  while (i < fromParts.length) {
    out.push("..");
    i = i + 1;
  }
  i = common;
  while (i < toParts.length) {
    out.push(toParts[i]);
    i = i + 1;
  }
  return out.join("/");
}

/** The meaningful segments of a normalised path: no empties, no bare `.`. */
function pathSegments(p: string): string[] {
  const out: string[] = [];
  for (const part of splitByte(p, SLASH)) {
    if (part.length > 0 && part !== ".") {
      out.push(part);
    }
  }
  return out;
}

/** `parts` joined with `/` and normalised, for building a path in pieces. */
export function joinPath(parts: string[]): string {
  const out = new StringBuilder();
  let first = true;
  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }
    if (!first) {
      out.add("/");
    }
    out.add(part);
    first = false;
  }
  return out.isEmpty() ? "." : normalizePath(out.toText());
}
