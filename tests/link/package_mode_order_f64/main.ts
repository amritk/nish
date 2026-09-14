// WP21 S2: the f64 half of `tests/link/package_mode_order` — a package whose
// manifest declares `"nish"` above `"nish-f64"`, compiled with
// `--number-mode f64` (`args`).
//
// It is the mode this matters most in: `docs/wp21-packages.md` §6 shows a
// program that divides, builds and runs under either mode and prints a
// different answer, which is why the mode selects the *file* rather than being
// checked afterwards. A declaration-order match would hand this program
// `./any.ts` and never compile the f64 source at all. 7 says it got `./f64.ts`.
import { seed } from "pkg_mode_f64";

export const main = (): i32 => seed() - 93;
