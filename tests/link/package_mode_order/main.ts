// WP21 S2: the number mode rides in the export condition, and this manifest
// declares the two conditions in the order that used to lose
// (`docs/wp21-packages.md` §6, §10a).
//
// `pkg_mode` declares `"nish"` above `"nish-i32"`. Node matches conditions in
// declaration order, which would compile `./any.ts` here and make `./i32.ts` —
// the file the package wrote for this mode — unreachable in silence: the
// program builds, links, runs, and answers a different number. That is the
// silent ABI mismatch the mode-qualified condition exists to prevent, so the
// compiler asks the whole condition map for its own mode before it asks for
// plain `nish`. The exit code says which file it got: 7 from `./i32.ts`, and
// 164 (that is -92) from `./any.ts`.
import { seed } from "pkg_mode";

export const main = (): i32 => seed() - 93;
