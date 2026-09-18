// WP21 S2: the package is installed *above* the directory the compiler is run
// in — `proj/node_modules` beside `proj/src/main.ts`, compiled as `nish
// main.ts` from `proj/src`, which is the layout npm produces and the way a
// program in a subdirectory is usually compiled.
//
// The point is the walk, so the entry is named relatively and the working
// directory is this file's own (`tests/run.js` spawns it that way): stage0
// climbs an absolute path and stage1 has no `process.cwd()` to make one, so a
// compiler that stops at `.` answers `` Cannot find package `pkg_above` `` for
// a program the other one compiles. Both compilers are run over this fixture
// and their IR is compared byte for byte.
//
// `helper` is private here and private in the package, and they answer
// different numbers, so the exit code is 7 only if each call reached its own
// package's (WP21 S1).
import { scale } from "pkg_above";

const helper = (): i32 => 3;

export const main = (): i32 => scale(1) + helper();
