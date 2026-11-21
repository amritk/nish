// WP28: the features of the compatibility dialect, by name. `--compat=<list>`
// and `nish.compat` in a `package.json` are checked against this one table,
// and a stage that builds a feature adds its name here.
//
// C1 builds `nullish` (a `??` whose left operand strict refuses for it),
// `optional-chaining` (a statement `a?.b`, `a?.[i]` and `a?.m()`),
// `string-switch` (a `switch` over a `string` with constant labels) and
// `for-of-string` (a `for...of` over a `string`, a code point per pass),
// `optional-params` (`x?: T` and a default that is not a constant, evaluated
// on each call that leaves it out) and `overloads` (bodiless signatures before
// one implementation, `src/overloads.ts`); a feature a build does not allow leaves the dialect accepting what strict
// accepts.

import { NUMBER_MODE_F64 } from "./context"
import { Options } from "./options"

/** Every feature this compiler has built, in the order `--compat` lists them. */
export const compatFeatureNames = (): string[] => {
  const names: string[] = [
    "nullish",
    "optional-chaining",
    "string-switch",
    "for-of-string",
    "optional-params",
    "overloads",
  ]
  return names
}

/** Whether `name` is a feature this compiler has built. */
export const compatHasFeature = (name: string): boolean => {
  for (const known of compatFeatureNames()) {
    if (known === name) {
      return true
    }
  }
  return false
}

/** The known features as the clause a refusal of an unknown one ends with. */
export const compatKnownText = (): string => {
  const quoted: string[] = []
  for (const name of compatFeatureNames()) {
    quoted.push(`\`${name}\``)
  }
  return `the ones this compiler has built are ${quoted.join(", ")}`
}

/** How the artifact spells the number mode a build settled on. */
const numberModeName = (opts: Options): string => (opts.numberMode === NUMBER_MODE_F64 ? "f64" : "i32")

/**
 * The `!nish.compat` operand list of a compat build: the number mode, then
 * each allowed feature, as LLVM metadata strings. Everything on the dialect
 * axis is in it, so a module says what its source meant.
 */
export const compatMetadata = (opts: Options): string => {
  const parts: string[] = [`!"${numberModeName(opts)}"`]
  for (const feature of opts.compatFeatures) {
    parts.push(`!"${feature}"`)
  }
  return `!{${parts.join(", ")}}`
}

/** The `--emit-checked` line of a compat build, which a strict build does not print. */
export const compatCheckedLine = (opts: Options): string =>
  `compat number=${numberModeName(opts)} features=[${opts.compatFeatures.join(",")}]`
