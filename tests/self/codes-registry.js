/**
 * The diagnostic-code registry, read back out of a `codes.ts`.
 *
 * `src/codes.ts` and `self/codes.ts` hold the same table in the same order --
 * a fragment line, then the `NL####` line that names its rule -- and three
 * places in this repository read it back: `scripts/gen-diagnostic-codes.mjs`,
 * which preserves every number it has already handed out;
 * `tests/diagnostic_coverage.js`, which asks which codes the suite reaches;
 * and the `codes:` checks in `tests/run.js`, which require the two compilers
 * to hold the same table. This module is that parse, once, so the copies
 * cannot drift apart again
 * ([issue #96](https://github.com/amritk/nish/issues/96)).
 *
 * The generator reaching into `tests/` for it is why `package.json` stops
 * shipping that script, exactly as it already stops shipping
 * `scripts/arrow-verify.mjs` for importing `tests/self/corpus.js`. Neither is
 * a loss: both read `src/`, which no tarball carries either.
 *
 * Two properties are the whole point of having it, and both are here because
 * they have failed:
 *
 *   - **The indentation is not part of the contract.** `self/codes.ts` lost a
 *     level when WP22 stage C rewrote its tables as arrows with concise
 *     bodies, and every reader keyed on four literal spaces then read it as
 *     *empty* rather than as changed. `^\s+` is what a pair is recognised by.
 *   - **Nothing is an empty registry.** A reader that answers `[]` for a file
 *     whose shape has moved makes "every code is covered" and "there are no
 *     codes" the same answer, which is what let the first instance of this
 *     survive unnoticed. This one raises instead.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");

/**
 * One entry of the emitted table: the quoted fragment on its own line, then
 * the code on the next. Anchored to the line rather than to a column, for the
 * reason in the header.
 */
const PAIR = /^\s+("(?:[^"\\]|\\.)*"),\n\s+"(NL\d{4})",$/gm;

/**
 * Every `{ fragment, code }` of one registry file, in the order the file holds
 * them -- which is the order the compilers match in, longest fragment first,
 * so a caller comparing two registries is comparing their behaviour and not
 * just their contents.
 *
 * Pairs rather than a `Map` because the three callers key it three different
 * ways, and because a `Map` would quietly swallow a duplicated fragment that a
 * caller may want to see.
 *
 * Throws when it parses nothing: an unreadable registry is a broken one, and
 * the one thing it may not do is pass for an empty one. `label` is what that
 * message names the text by.
 */
export const parseCodesRegistry = (text, label) => {
  const pairs = [];
  for (const m of text.matchAll(PAIR)) {
    pairs.push({ fragment: JSON.parse(m[1]), code: m[2] });
  }
  if (pairs.length === 0) {
    throw new Error(`${label}: no diagnostic codes parsed -- the registry's shape has moved`);
  }
  return pairs;
};

/** The same, for a registry on disk. The three callers all read a file. */
export const readCodesRegistry = (file) =>
  parseCodesRegistry(fs.readFileSync(file, "utf8"), path.relative(root, file));
