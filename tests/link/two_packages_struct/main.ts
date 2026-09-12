// WP21 S1 scopes function symbols and deliberately stops there. A class is
// still one `%struct.<name>` for the whole program and type equality still
// compares names, so two packages that each keep a private `Node` would
// silently be treated as declaring one type — one layout standing in for the
// other, which is a miscompile and not a link error.
//
// Rather than half-scope the layouts, the compiler says so and names both
// packages. Scoping them, and deciding what a `Point` from two versions of one
// package means, is docs/wp21-packages.md §7. Neither class is exported and
// neither crosses a module boundary: the clash is the name alone.
import { first } from "./node_modules/pkg_a/index";
import { second } from "./node_modules/pkg_b/index";

export const main = (): i32 => first() + second();
