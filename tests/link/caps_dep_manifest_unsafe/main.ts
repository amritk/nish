// WP40: `unsafe` may be granted to a dependency: NL3034 refuses it only in
// the root package's own `allow`, where the import is the opt-in. The root's
// `allow` does not list it, and `unsafe` needs no listing there. Exit code 4.
import { mix } from "pkg_fast";

export const main = (): i32 => mix(7) + 4;
