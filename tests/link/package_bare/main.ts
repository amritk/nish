// WP21 S2: a package imported by name (`docs/wp21-packages.md` §5b, §6).
//
// Three things are proved at once, and each is a different row of the `exports`
// map the fixture packages carry:
//
//   - `pkg_bare` resolves through `node_modules` and the `nish` condition, and
//     `pkg_bare/util` resolves the `./util` **subpath** of the same package.
//   - `@scope/hash` is a scoped name, and its manifest is the one-entry
//     shorthand (`"exports": { "nish-i32": ..., "nish": ... }`), so this i32
//     compile picks `./i32.ts` and an f64 one would pick `./any.ts`. The
//     arithmetic is the assertion: only the i32 file answers 100. The order the
//     two conditions are written in is not what selects here — the compiler
//     ranks the mode-qualified one above the plain one either way, and
//     `tests/link/package_mode_order` is the same question asked of a manifest
//     that declares them the other way round.
//   - Every package keeps a private `helper()`, as does this program, and the
//     symbols stay apart because each carries its package's prefix (WP21 S1).
//
// The exit code is right only if each call reached the file the condition
// selected: 6 + 30 + 100 - 129 = 7.
import { scale } from "pkg_bare";
import { twice } from "pkg_bare/util";
import { seed } from "@scope/hash";

const helper = (n: i32): i32 => n - 129;

export const main = (): i32 => helper(scale(2) + twice(15) + seed());
