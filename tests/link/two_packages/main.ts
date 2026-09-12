// WP21 S1: two packages, each with a private `helper()`, compiling and linking
// into one program — the case `docs/wp21-packages.md` §5a names as the blocker
// for a package ecosystem, and the reason symbols had to stop being bare names.
//
// Three functions here are called `helper` and two are called `scale`. Before
// package-scoped symbols the whole-program fact table was keyed by the name
// alone, so the second `helper` would have been given the first one's purity,
// escape and pointer facts; `Compilation` refused the program outright rather
// than emit that (`tests/link/duplicate_internal` is the same rule inside one
// package, where it still holds). Now each package's symbols carry its own
// prefix, the root package's prefix is empty, and the three `helper`s are
// `@helper`, `@pkg_a.helper` and `@pkg_b.helper`.
//
// The arithmetic is the assertion: every `helper` computes something different,
// so the exit code is 7 only if each call reached its own package's.
import { scale as scaleA } from "./node_modules/pkg_a/index";
import { scale as scaleB } from "./node_modules/pkg_b/index";

const helper = (n: i32): i32 => n - 42;

export const main = (): i32 => helper(scaleA(10) + scaleB(10));
