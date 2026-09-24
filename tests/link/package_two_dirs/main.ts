// One package name at two real directories: the program uses `hash` 1.0.0 and
// its dependency `user` has its own `hash` 2.0.0 nested under it — npm's
// layout for two versions it cannot hoist into one, and `docs/wp21-packages.md`
// §7's diamond. A package's identity is its real directory, and a program
// compiles one copy of a package, so the second directory is refused at the
// import that reached it, naming both directories and both versions.
//
// Compiled, the two copies were two modules of package `hash` declaring one
// `digest`, and the program was refused all the same — by accident, as a
// duplicate export.
import { digest } from "hash";
import { user } from "user";

export const main = (): i32 => digest() + user();
