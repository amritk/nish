#!/usr/bin/env node
/**
 * `nish-cmp` — one corpus, two compilers, byte for byte (WP19 §3 gate G2.1).
 *
 *   node tests/nish-cmp.js --help
 *   node tests/nish-cmp.js --reference <released nish> --candidate build/self/compile
 *   NISH_BOOTSTRAP=/usr/local/bin/nish node tests/nish-cmp.js
 *   node tests/nish-cmp.js -r <ref> -c <cand> tests/cases/str_concat.ts
 *   node tests/nish-cmp.js -r <ref> -c <cand> --verbose --lines 10
 *
 * This is Go's `toolstash -cmp`. Compile the whole corpus with the compiler
 * that is trusted — the last released `nish` — and with the compiler HEAD
 * builds, and require every byte of every file they write to be the same. It
 * is the successor to `tests/self/ir_oracle.js` and
 * `tests/self/interop_oracle.js`, which compared stage0 with stage1 and were
 * deleted with stage0 (`docs/wp19-stage0-retirement.md` §2B), so it compares
 * what the two of them compared together: the IR of every module of every program, and
 * the four WP8 sidecars derived from the same checked program.
 *
 * **Both compilers are parameters, and neither is assumed to exist.** Nish has
 * never been tagged — 0.1.0 is about to be its first release — so a tool that
 * assumed a released `nish` was on disk could not run at all today, and one
 * that quietly compared HEAD with itself would be worse than not running.
 * `--reference` therefore defaults to `$NISH_BOOTSTRAP`, the variable
 * `scripts/bootstrap.sh` reads for the seed (G3), and when there is no seed
 * anywhere the run **skips and says why**, in the runner's own words, because
 * a green line that proved nothing is the failure mode `.claude/orientation.md`
 * warns about.
 *
 * Either compiler may be a native binary or a Node entry point: the seed after
 * 0.1.0 is a binary and today's compiler is a Node program, so both have to be
 * spellable. The rule is the file's extension — `.js`, `.mjs` and `.cjs` run
 * under `node`, anything else is executed directly.
 *
 * **What is compared, and what is deliberately not.**
 *
 *   - every file the compilers write, byte for byte: one `.ll` per module, and
 *     `<stem>.h`, `<stem>.d.ts`, its companion `<stem>.mjs` and `<stem>.napi.c`
 *     unless `--no-sidecars`. The *set* of files counts too, so a version that
 *     wrote one module fewer has not agreed about the rest;
 *   - whether the program compiles at all. A program the reference accepts and
 *     the candidate refuses is the regression this tool exists to catch, and a
 *     program the reference refuses and the candidate accepts is a language
 *     change, which is a CHANGELOG line rather than a silent improvement;
 *   - not the wording of diagnostics, and not the dumps. A program both
 *     compilers refuse is counted and named apart (there is no artefact on
 *     either side); its message is pinned by the `.err` fragments checked in
 *     beside it, which `tests/self/reject_oracle.js` reads. A program compiled with `--emit-ast` or `--emit-checked` writes
 *     no artefact either, and its stdout is pinned by the `<name>.stdout`
 *     golden beside it. Both are counted in the summary rather than folded
 *     into a skip count;
 *   - not **where each compiler's own standard library lives**. A module
 *     reached as `nish/<name>` is resolved against the compiler's own package
 *     root and then named by the path it was found at, so the seed writes
 *     `; ModuleID = '<where the seed is unpacked>/std/text.ts'` and HEAD writes
 *     `std/text.ts` — the same module, named by each compiler's own install.
 *     Two compilers are never installed in one place, so this is a property no
 *     run of this tool can compare rather than a difference it may forgive:
 *     each side's own root is removed before the bytes are compared, which
 *     leaves the module's path *relative to its own package* on both sides, and
 *     the summary says how many files needed it. `packageRootOf` derives each
 *     root the way the compilers do, `withoutOwnRoot` removes it, and
 *     `selfCheckRoots` drives both over fabricated inputs on every run, because
 *     a comparison whose own logic nothing exercises is the gap
 *     `docs/wp19-stage0-retirement.md` §5a records about every other oracle
 *     here. What is *not* set aside is anything else on those lines: a path
 *     that is not under the compiler's own root is compared as it stands;
 *   - not **each compiler's own version in the DWARF `producer`**. A `-g`
 *     build records `producer: "nish <version>"`, and the reference is the
 *     *last* release while HEAD already carries the next version number from
 *     the moment the release pull request bumps it — so without this, every
 *     `-g` case goes red at every release, on the release pull request and on
 *     every branch after it until the release is published and becomes the
 *     seed. `tests/run.js`'s `normaliseProducer` lets the same digits go for
 *     the goldens. It is removed the way the root is: each side's *own*
 *     version, as its `--version` prints it, and only inside a `producer:`
 *     string, so a candidate that records any version but its own — the
 *     reference's, a stale constant — still differs. `withoutOwnVersion` does
 *     it, `selfCheckVersions` drives it over fabricated inputs on every run,
 *     and the summary counts the files that needed it.
 *
 * **A difference must be named in the release notes.** `DECLARED` below is
 * how: an entry names the program and the file that may differ, the sentence
 * saying why, and the words the notes have to carry for the declaration to
 * hold. The notes are `CHANGELOG.md` for what has been released, and for what
 * has not, the section `scripts/changelog-gen.mjs` would render from the
 * commits since the last release tag — the words a pull request's own subject
 * will land as. `CHANGELOG.md` is written by that generator when a release is
 * cut, so a hand-written line there is duplicated by the next release; reading
 * the generator's pending section instead lets a pull request name its change
 * without touching the file. A difference no entry covers fails the run; an
 * entry whose words are in neither fails the run as well, so the release note
 * and the tool cannot drift apart. The intent is that the list stays short: it
 * is a record of intended output changes for one release, not an allowlist to
 * grow.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extraArgs, linkPrograms, programs, root } from "./self/corpus.js";

/**
 * Output differences that are decided rather than broken, each with the words
 * `CHANGELOG.md` must carry before this run can go green. Shape:
 *
 *   {
 *     program: "tests/cases/str_concat.ts",  // omit for every program
 *     file: "str_concat.ll",                 // omit for every file of it
 *     changelog: "string concatenation now calls `nish_str_concat2`",
 *     why: "one sentence somebody is willing to sign, in their own words",
 *   }
 *
 * `changelog` is matched against `CHANGELOG.md` and against the pending
 * release section (`pendingNotes`), so for an unreleased change it is the
 * pull request's subject as the generator renders it: the scope dropped, the
 * first letter raised, and no `(#N)`.
 *
 * A declaration is deliberately narrow — one program, one file — so that the
 * *next* difference in the same place is still reported. A release that
 * changes the IR of the whole corpus is a declaration with no `program` and a
 * paragraph in `CHANGELOG.md` to match, and it should feel like a bigger thing
 * to write than five narrow ones, because it is.
 */
const DECLARED = [
  {
    program: "tests/cases/perf_bounds_toi32.ts",
    file: "perf_bounds_toi32.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program: the `toI32(w.length)` hoist proven in i32 mode, which the reference compiler still checks",
  },
  {
    program: "tests/cases/perf_bounds_toi32_f64.ts",
    file: "perf_bounds_toi32_f64.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program: the same hoist under --number-mode f64, which the reference compiler still checks",
  },
  {
    program: "tests/cases/perf_bounds_toi32_loop.ts",
    file: "perf_bounds_toi32_loop.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "a new program; its two loop checks stay, but `xs[0]` loses its check: the builtin `toI32` calls before it no longer drop the length its array literal proved",
  },
  {
    program: "docs/cookbook/str_bounds_toi32.ts",
    file: "str_bounds_toi32.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the cookbook snippet for the `toI32(s.length)` hoist, whose check the reference compiler keeps",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)` too, so its checks are now proven",
  },
  {
    program: "tests/link/std_text/main.ts",
    file: "main.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the imported std/text and std/testing functions' attributes change with their dropped panics",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven under --number-mode f64 as well",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing's `toI32(x.length)` hoists are proven under --number-mode f64 as well",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "main.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "the imported std/text and std/testing functions' attributes change with their dropped panics",
  },
  {
    program: "tests/link/std_testing/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_testing_fail/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "testing.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/testing hoists `toI32(x.length)`, so its checks are now proven",
  },
  {
    program: "tests/link/std_package_scope/main.ts",
    file: "text.ll",
    changelog: "Prove bounds through toI32(length) and compile std/text silent",
    why: "std/text's checks and clamps are proven through `toI32(w.length)` and its rewritten guards",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "json.ll",
    changelog: "Hold std/ and examples/ to zero performance warnings and ratchet self/",
    why: "std/json's reads and `substring` clamps are proven by the guards it now states, through `toI32(w.length)`, which the reference compiler still checks",
  },
  {
    program: "tests/link/std_text_f64/main.ts",
    file: "json.ll",
    changelog: "Hold std/ and examples/ to zero performance warnings and ratchet self/",
    why: "the same std/json proofs under --number-mode f64",
  },
  {
    program: "tests/cases/gen_constraint.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: `<T extends Shape>` at two implementers, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_class.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a generic class with a constrained parameter, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_generic_bound.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a constraint that is an instantiation, `T extends Container<i32>`, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_method.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a method called through a class constraint, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_two.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: two parameters with different constraints, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/gen_constraint_write.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: a field written through a constrained parameter, which the reference compiler refuses to parse",
  },
  {
    program: "docs/cookbook/gen_constraint.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new cookbook snippet: the constrained-parameter lowering, which the reference compiler refuses to parse",
  },
  {
    program: "tests/link/generic_constraint_import/main.ts",
    file: "exit",
    changelog: "Constrained type parameters (WP18 G6)",
    why: "a new program: constrained templates imported from another module, which the reference compiler refuses to parse",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/cases/interop_generic_collision.ts",
    file: "interop_generic_collision.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/cases/interop_generic_fn.ts",
    file: "interop_generic_fn.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/link/generic_constraint_import_back/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_constraint_same_name_fields/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: a class implementing the importer's own same-named `Shape`, with lib's fields, which the reference compiler took for lib's `Shape` and compiled",
  },
  {
    program: "tests/link/generic_constraint_same_name_itself/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: the importer's own same-named `Shape` passed as the argument, which shares lib's type id and which the reference compiler compiled",
  },
  {
    program: "tests/link/generic_constraint_same_name_class/main.ts",
    file: "exit",
    changelog: "Hold a constraint to its declaration, not its name",
    why: "a new negative: the importer's own same-named `Base` class passed to a `T extends Base` bound on lib's class, which shares its type id and which the reference compiler compiled",
  },
  {
    program: "tests/link/iface_same_name_class/main.ts",
    file: "exit",
    changelog: "Same-named interfaces and classes across modules keep their identity",
    why: "a new negative: lib's `Circle` converted to the importer's own same-named `Shape`, which shares lib's `Shape`'s type id and which the reference compiler compiled, reading `Circle`'s layout as the wrong `Shape`'s",
  },
  {
    program: "tests/link/package_engines_floor/main.ts",
    file: "exit",
    changelog: "WP21 S3 — specific diagnostics at the package boundary",
    why: "a new negative: a package whose `engines.nish` floor is above this compiler, which the reference compiler does not read and so compiled",
  },
  {
    program: "tests/link/package_engines_range/main.ts",
    file: "exit",
    changelog: "WP21 S3 — specific diagnostics at the package boundary",
    why: "a new negative: an `engines.nish` range that is not a floor, refused rather than taken as met, which the reference compiler does not read and so compiled",
  },
  {
    program: "tests/cases/dbg_generic.ts",
    file: "dbg_generic.ll",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "a new program: with -g the reference compiler names the class `Box$i32` and its methods `Box$i32.get`, where HEAD writes `Box<i32>`, `Box<i32>.get` and `identity<Box<i32>>`",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_constraint_import/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.d.ts",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "the comment above the exported `Cell<f64>` constructor names it as written, where the reference wrote the symbol `Cell$f64.constructor`",
  },
  {
    program: "tests/cases/perf_padding_quiet.ts",
    file: "perf_padding_quiet.napi.c",
    changelog: "Spell an instantiated class as written, in diagnostics and -g (WP18 G8)",
    why: "the comment above the exported `Cell<f64>` constructor names it as written, where the reference wrote the symbol `Cell$f64.constructor`",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword; and the comments above the methods of `Box<i32>` and `Box<Point>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_import/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`; and the comments above the methods of `Box<i32>` and `Box<Point>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword; and the comments above the methods of `Box<Pair<i32>>` and `Pair<i32>` name them as written, where the reference wrote their mangled symbols",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_import_chain/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.d.ts",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation is declared under its `nish_gen_` C name, since the mangled symbol is not always a JavaScript identifier",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.h",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "an instantiation's C name is now `nish_gen_` and the escaped collapse, and its comment says it is an instantiation rather than a C keyword",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.mjs",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the loader exports an instantiation under its `nish_gen_` C name, and still calls the raw export by its symbol",
  },
  {
    program: "tests/link/generic_two_importers/main.ts",
    file: "main.napi.c",
    changelog: "Export generic instantiations under valid, injective names (WP18 G8)",
    why: "the addon exports and wraps an instantiation under its `nish_gen_` C name, so no C identifier holds `$` or `.`",
  },
  {
    program: "tests/cases/gen_method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Chooser.pick<T>` on a non-generic class, which the reference compiler refuses at the `<` after the method name (`a type annotation is required`) and HEAD compiles to `@Chooser.pick$i32` and `@Chooser.pick$str`",
  },
  {
    program: "tests/cases/gen_method_generic_class.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Box<T>.pair<U>` at two receivers and two method tuples, which the reference compiler refuses at the method's type parameter list and HEAD compiles to four defines",
  },
  {
    program: "tests/cases/gen_method_constraint.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `apply<U extends Shape>` on a plain class and `plus<U extends Shape>` on a generic one, which the reference compiler refuses at the method's type parameter list and HEAD compiles to direct field reads",
  },
  {
    program: "tests/cases/gen_method_export.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: an exported class's generic methods, which the reference compiler refuses at the method's type parameter list and HEAD compiles, with each instantiation in the header as `nish_gen_Holder_pick_i32` and the like",
  },
  {
    program: "tests/cases/dbg_generic_method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: `Box<i32>.pair<U>` under -g, which the reference compiler refuses at the method's type parameter list and HEAD compiles with `DISubprogram`s named `Box<i32>.pair<string>` and `Box<i32>.pair<i32>`",
  },
  {
    program: "docs/cookbook/gen_method.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "the cookbook snippet for a generic method, which the reference compiler refuses at the method's type parameter list and HEAD compiles to `@Chooser.pick$i32`, `@Chooser.pick$str` and `@Box$i32.keep$str`",
  },
  {
    program: "tests/link/generic_method_import/main.ts",
    file: "exit",
    changelog: "Generic methods on classes (WP18 §14 q7)",
    why: "a new program: an exported class's generic methods called from two importers, which the reference compiler refuses at the method's type parameter list in lib.ts and HEAD compiles with one `define` per instantiation, in lib.ll",
  },
  // #106: `self/bounds.ts` proves `h.xs[i]` from `h.xs.length`, so the compiler's
  // own accesses through a field lose their checks and every module of it moves,
  // bounds checks and the attributes a dropped panic frees alike. One entry per
  // `self/` program, read from the corpus rather than listed, because the reason
  // is the same for all of them.
  ...programs()
    .map((file) => path.relative(root, file))
    .filter((program) => program.startsWith("self/"))
    .map((program) => ({
      program,
      changelog: "Key bounds length facts by property path",
      why: "the compiler's own field-held accesses are proven by property-path length facts, so their checks and the attributes a dropped panic frees move in every module",
    })),
  {
    program: "bench/hoist_field.ts",
    file: "hoist_field.ll",
    changelog: "Key bounds length facts by property path",
    why: "`fieldScan`'s `h.xs[i]` is proven by `i < h.xs.length`, the check the reference compiler keeps and the 2.38x this change measures",
  },
  {
    program: "tests/cases/arr_header_hoist.ts",
    file: "arr_header_hoist.ll",
    changelog: "Key bounds length facts by property path",
    why: "`@fieldScale`'s `h.xs[i]` loses its check, so its loop is `@constScale`'s register for register",
  },
  {
    program: "tests/cases/arr_path_hold.ts",
    file: "arr_path_hold.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: the accesses a property-path fact proves, whose checks the reference compiler keeps",
  },
  {
    program: "tests/cases/arr_path_nullable.ts",
    file: "arr_path_nullable.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `@plain`'s path from a `Holder` is proven where the reference compiler keeps the check; `@narrowed`'s, from a `Holder | null`, keeps it in both",
  },
  {
    program: "tests/link/reachable_struct/main.ts",
    changelog: "Key bounds length facts by property path",
    why: "`this.entries.length > 0 ? this.entries[0] : null` in lib.ts is proven by the guard on the path, so lib.ll drops its `nish_panic_index` and main.ll's declarations of lib's methods regroup their attributes",
  },
  // The local forms of the two ordering holes #179's review found. The seed
  // proves each of these accesses and reads or writes past the array; HEAD keeps
  // the check, so the difference is the fix.
  {
    program: "tests/cases/arr_bounds_cond_effect.ts",
    file: "arr_bounds_cond_effect.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `i < xs.length && drain(xs) > 0` no longer proves `xs[i]`, which the reference compiler proves and reads past",
  },
  {
    program: "tests/cases/arr_bounds_cond_assign.ts",
    file: "arr_bounds_cond_assign.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `i < xs.length && (xs = short).length > 0` no longer proves `xs[i]`, which the reference compiler proves and reads past",
  },
  {
    program: "tests/cases/arr_bounds_store_rhs.ts",
    file: "arr_bounds_store_rhs.ll",
    changelog: "Key bounds length facts by property path",
    why: "a new program: `xs[i] = (i = 0)` keeps its check, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_path_continue_for.ts",
    file: "arr_path_continue_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that stores `h.xs` keeps the check on the `for` update's `h.xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_path_continue_do.ts",
    file: "arr_path_continue_do.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a call before `continue` keeps the check on the `do/while` condition's `h.xs[i]`, which the reference compiler drops and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_for.ts",
    file: "arr_bounds_continue_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that rebinds `xs` keeps the check on the `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_do.ts",
    file: "arr_bounds_continue_do.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` that rebinds `xs` keeps the check on the `do/while` condition's `xs[i]`, which the reference compiler drops and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_lazy_unwrap_or.ts",
    file: "arr_bounds_lazy_unwrap_or.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an `unwrapOr` fallback that never ran proves nothing, so `s.charCodeAt(i)` keeps the check the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_lazy_expect.ts",
    file: "arr_bounds_lazy_expect.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an `expect` message that never ran proves nothing, so `s.charCodeAt(i)` keeps the check the reference compiler drops",
  },
  {
    program: "tests/cases/arr_header_hoist_record_store.ts",
    file: "arr_header_hoist_record_store.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a whole-record store into `rs` keeps `r.xs` from being hoisted, where the reference compiler hoists it and reads the replaced array",
  },
  {
    program: "tests/cases/arr_bounds_continue_nested.ts",
    file: "arr_bounds_continue_nested.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: an outer `continue` that rebinds `xs`, followed by an inner loop with its own `continue`, keeps the check on the outer `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_continue_switch.ts",
    file: "arr_bounds_continue_switch.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `continue` in a `switch` clause that rebinds `xs` keeps the check on the `for` update's `xs[i]`, which the reference compiler drops and writes past the array",
  },
  {
    program: "tests/cases/arr_bounds_break_for.ts",
    file: "arr_bounds_break_for.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body moves `i` keeps the check on `xs[i]` after the `for`, which the reference compiler drops because the condition proved it",
  },
  {
    program: "tests/cases/arr_bounds_break_while.ts",
    file: "arr_bounds_break_while.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body rebinds `xs` keeps the check on `xs[5]` after the `while`, which the reference compiler drops because the condition proved it",
  },
  {
    program: "tests/cases/arr_bounds_break_for_string.ts",
    file: "arr_bounds_break_for_string.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a guarded `break` after the body moves `k` keeps the check on `s.charCodeAt(i)` under `i < k`, which the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_break_while_string.ts",
    file: "arr_bounds_break_while_string.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a `break` after the body moves `k` keeps the check on `s.charCodeAt(i)` under `i < k`, which the reference compiler drops",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances.ts",
    file: "arr_bounds_generic_instances.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk<Box>` proves `r.xs[i]` and `walk<Rec>`, whose whole-record store replaces the array under `r`, keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_prim.ts",
    file: "arr_bounds_generic_instances_prim.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk<i32>` proves `r.xs[i]` and `walk<Rec>` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_method.ts",
    file: "arr_bounds_generic_instances_method.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `Store<Box>.walk` proves `r.xs[i]` and `Store<Rec>.walk` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_bounds_generic_instances_iface.ts",
    file: "arr_bounds_generic_instances_iface.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: `walk` over `Cell<string>` proves `r.xs[i]` and over `Cell<Rec>` keeps the check, where the reference compiler judges both instantiations from one shared table and reads past the array",
  },
  {
    program: "tests/cases/arr_header_hoist_record_view.ts",
    file: "arr_header_hoist_record_view.ll",
    changelog: "Bounds proofs see continue edges, lazy Result arguments and whole-record stores",
    why: "a new program: a whole-record store into `rs` keeps `c.rec.xs`, read off a `Rec` view in a class field, from being hoisted and keeps its check, where the reference compiler hoists it and reads the replaced array",
  },
  {
    program: "docs/cookbook/arr_bounds_path.ts",
    file: "arr_bounds_path.ll",
    changelog: "Key bounds length facts by property path",
    why: "the cookbook snippet for a property-path fact, whose `h.xs[i]` check the reference compiler keeps",
  },
  {
    program: "tests/link/std_pair_scalar/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32, boolean>` returned across a module boundary, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_f64/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<string, f64>` under --number-mode f64, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_array/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32[], string>`, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_nested/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a nested `Pair<Pair<i32, i32>, string>`, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/link/std_pair_held/main.ts",
    file: "exit",
    changelog: "Pair<A, B> as a standard-library type",
    why: "a new program: a `Pair<i32, boolean>` held in a class field and pushed into an array, which the reference compiler refuses because its std/ has no pair.ts",
  },
  {
    program: "tests/cases/attr_panic_charcodeat.ts",
    file: "attr_panic_charcodeat.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "a new program: `@at` and `@nish_main` reach `nish_panic_index` through an unproven `charCodeAt` and are not `willreturn`, where the reference compiler marks both and the speed profile deletes the panic",
  },
  {
    program: "tests/cases/str_bytes.ts",
    file: "str_bytes.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@firstByte`'s unproven `charCodeAt(0)` can reach `nish_panic_index`, so it and `@test` lose `willreturn`, and `@firstByte` its `readonly`, as an unproven `a[i]` already does",
  },
  {
    program: "docs/cookbook/str_bytes.ts",
    file: "str_bytes.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@firstByte`'s unproven `charCodeAt(0)` can reach `nish_panic_index`, so it loses `willreturn` and `readonly` and the attribute groups renumber",
  },
  {
    program: "tests/cases/arr_path_cond_string.ts",
    file: "arr_path_cond_string.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@code`'s unproven `t.s.charCodeAt(i)` can reach `nish_panic_index`, so it and `@nish_main` lose `willreturn`",
  },
  {
    program: "tests/differential/corpus/str_methods.ts",
    file: "str_methods.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@nish_main`'s unproven `charCodeAt` can reach `nish_panic_index`, so it loses `willreturn` and the attribute groups renumber",
  },
  {
    program: "tests/link/result_import/main.ts",
    file: "lib.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "`@parseDigit`'s unproven `text.charCodeAt(at)` can reach `nish_panic_index`, so it loses `willreturn`",
  },
  {
    program: "tests/link/result_import/main.ts",
    file: "main.ll",
    changelog: "A function whose unproven charCodeAt can panic is not willreturn",
    why: "the importer's `declare` of `@parseDigit` loses `willreturn` with its definition, and the attribute groups renumber",
  },
  {
    program: "tests/link/class_clash_fields/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: #193's two same-named classes with fields only, which the reference compiler merges into one type and compiles, and HEAD refuses at the second declaration",
  },
  {
    program: "tests/link/iface_clash_private/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: #193's private interface passed across modules as a same-named one, which the reference compiler compiles and HEAD refuses at the second declaration",
  },
  {
    program: "tests/link/class_dollar_name/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: a declared `class Box$i32` beside the instantiation `Box<i32>`, which the reference compiler merges into one type and compiles, and HEAD refuses for its `$`",
  },
  {
    program: "tests/link/class_dollar_name_imported/main.ts",
    file: "exit",
    changelog: "Refuse two same-named classes or interfaces in one package",
    why: "a new program: `class_dollar_name` in the other load order, which the reference compiler compiles and HEAD refuses for the `$` in the name it was written with",
  },
  {
    program: "tests/link/package_symlink/main.ts",
    file: "exit",
    changelog: "Module and package identity is the real path",
    why: "pnpm's layout, one package reached through a symlink, which the reference compiler loads as two copies and refuses as a clash on `val`, and HEAD compiles as one package (#198)",
  },
  {
    program: "tests/link/identity_symlink_cwd/main.ts",
    file: "exit",
    changelog: "Module and package identity is the real path",
    why: "a new program: one file named as a root through a linked directory beside an import of it, which the reference compiler loads as two modules and refuses as a duplicate export, and HEAD loads once (#198)",
  },
  {
    program: "tests/link/identity_symlink_dotdot/main.ts",
    file: "types.ll",
    changelog: "Module and package identity is the real path",
    why: "a new program: `types.ts` and `far/../types.ts` are two files whose stems meet, and the reference compiler writes the second over the first, so its `types.ll` is the root's where HEAD's is the import's (#198)",
  },
  {
    program: "tests/link/identity_symlink_dotdot/main.ts",
    file: "types_2.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: HEAD names the second module `types_2.ll` rather than overwriting the first, and the reference compiler writes no such file (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "index.ll",
    changelog: "Module and package identity is the real path",
    why: "a new program: a workspace link `node_modules/foo -> ../packages/foo`, whose modules HEAD names under the package's real directory, `packages/foo/index.ts`, where the reference compiler names them through the link (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "node_modules_foo_helper.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: the reference compiler stems `foo`'s own `helper.ts` from the link's spelling, and HEAD writes it as `packages_foo_helper.ll` (#198)",
  },
  {
    program: "tests/link/package_workspace/main.ts",
    file: "packages_foo_helper.ll",
    changelog: "Module and package identity is the real path",
    why: "the same program: HEAD stems `foo`'s own `helper.ts` from the package's real directory, a file the reference compiler does not write (#198)",
  },
  {
    program: "tests/cases/arr_readonly_field.ts",
    file: "arr_readonly_field.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/arr_strings.ts",
    file: "arr_strings.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/cls_interface_literal.ts",
    file: "cls_interface_literal.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/conv_f64_context.ts",
    file: "conv_f64_context.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/diag_order.ts",
    file: "diag_order.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/diag_order_pass1.ts",
    file: "diag_order_pass1.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/fn_arrow_concise.ts",
    file: "fn_arrow_concise.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/io_spawn.ts",
    file: "io_spawn.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "docs/cookbook/mem_callee_scope.ts",
    file: "mem_callee_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "the cookbook snippet for the callee scope: `size` brackets itself, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_callee_scope.ts",
    file: "mem_callee_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `List.benchmark` brackets itself with the callee scope, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_callee_scope_escape.ts",
    file: "mem_callee_scope_escape.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose functions correctly get no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_nested.ts",
    file: "mem_callee_scope_nested.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose `keep` correctly gets no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_return.ts",
    file: "mem_callee_scope_return.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program whose `summary` correctly gets no callee scope; its `main` gets one, its parameters holding no pointer",
  },
  {
    program: "tests/cases/mem_callee_scope_tree.ts",
    file: "mem_callee_scope_tree.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `Storage.benchmark` brackets itself with the callee scope, which the reference compiler does not give it",
  },
  {
    program: "tests/cases/mem_getenv_scope.ts",
    file: "mem_getenv_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_nullable.ts",
    file: "mem_nullable.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_readdir_scope.ts",
    file: "mem_readdir_scope.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_reclaim_call.ts",
    file: "mem_reclaim_call.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_stack_ctor_capture.ts",
    file: "mem_stack_ctor_capture.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_stack_escape.ts",
    file: "mem_stack_escape.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/mem_threads_arena.ts",
    file: "mem_threads_arena.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/perf_arena_loop.ts",
    file: "perf_arena_loop.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "a new program: `quiet` gets the callee scope, and the two functions the new warning names do not",
  },
  {
    program: "tests/cases/perf_arena_quiet.ts",
    file: "perf_arena_quiet.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/perf_padding_suffix_gap.ts",
    file: "perf_padding_suffix_gap.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`test` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_by_value_param.ts",
    file: "res_by_value_param.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_propagate.ts",
    file: "res_propagate.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/cases/res_struct_error.ts",
    file: "res_struct_error.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "bench/strbuild.ts",
    file: "strbuild.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/arr_2d.ts",
    file: "arr_2d.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/arr_sort_reverse.ts",
    file: "arr_sort_reverse.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/class_prefix.ts",
    file: "class_prefix.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/io_roundtrip.ts",
    file: "io_roundtrip.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_basic.ts",
    file: "str_basic.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_build_loop.ts",
    file: "str_build_loop.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/str_template.ts",
    file: "str_template.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/differential/corpus/ternary_chain.ts",
    file: "ternary_chain.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/reachable_struct_chain/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_bare_specifier/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_json/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_array/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_held/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_pair_nested/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_testing/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/std_testing_fail/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
  {
    program: "tests/link/struct_array_field/main.ts",
    file: "main.ll",
    changelog: "Give a function the arena scope when only its callees allocate",
    why: "`main` gets the callee arena scope: it takes no pointer, and a callee leaves arena memory behind",
  },
];

/** Differing files printed in full before the rest are only counted. */
const MAX_ROWS = 20;

/** The dump flags: they print instead of writing IR, so there is no artefact to compare. */
const DUMP_FLAGS = new Set(["--emit-ast", "--emit-checked"]);

/**
 * `.js` / `.mjs` / `.cjs` is a Node entry point and everything else is a
 * native binary. This is `scripts/bootstrap.sh`'s rule for `NISH_BOOTSTRAP`
 * (WP19 G3), character for character, so that one path spells a seed in both
 * places: the kind is the suffix, deliberately not the executable bit, because
 * the bit describes the download — a binary out of a release tarball can
 * arrive without `+x` — and the suffix is what
 * whoever built the seed chose.
 */
const NODE_ENTRY = /\.(?:js|mjs|cjs)$/;

/**
 * The package root a compiler will answer for itself: the directory holding
 * `scripts/`, `runtime/` and `std/`.
 *
 * Derived the way the compilers derive it rather than guessed, because the
 * point of removing it is that it is *their* answer: `<dirname(argv[0])>/..`,
 * then the same for the real path — a compiler reached through a symlink
 * resolves the link (`self/compile.ts`'s `packageRootCandidates`) — and then
 * the working directory, which is where `compile` below spawns both of them.
 * The first candidate holding `scripts/build.sh` wins, which is the predicate
 * the compilers use, checked here against the filesystem instead of assumed.
 */
function packageRootOf(file) {
  const candidates = [path.join(path.dirname(file), "..")];
  try {
    candidates.push(path.join(path.dirname(fs.realpathSync(file)), ".."));
  } catch {
    // A compiler that cannot be realpath'd is one `resolveCompiler` has already
    // refused; there is simply no second candidate for it.
  }
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "scripts", "build.sh"))) return path.resolve(candidate);
  }
  return path.resolve(root);
}

/**
 * `text` with one compiler's own package root removed, so a path under it is
 * left relative to that package — `<seed>/std/text.ts` becomes `std/text.ts`,
 * which is what a compiler standing in its own root writes for the same module.
 *
 * The separator is part of what is removed, so a directory whose name merely
 * begins with the root's — `/opt/nish` against `/opt/nish-old/std/a.ts` — is
 * left alone. Nothing else is rewritten.
 */
function withoutOwnRoot(text, ownRoot) {
  if (ownRoot === undefined || ownRoot === null || ownRoot.length === 0) return text;
  const prefix = ownRoot.endsWith(path.sep) ? ownRoot : `${ownRoot}${path.sep}`;
  return text.split(prefix).join("");
}

/**
 * `withoutOwnRoot` over inputs a corpus cannot produce, on every run.
 *
 * It is four lines of string handling standing between a real difference and a
 * green summary, and §5a's last section names "no sibling oracle self-tests its
 * comparison logic" as a stage of its own. This is that check for the one piece
 * of comparison logic here that can *hide* something, and it costs microseconds.
 * Returns the reason it failed, or null.
 */
function selfCheckRoots() {
  const sep = path.sep;
  const cases = [
    [`; ModuleID = '${sep}opt${sep}nish${sep}std${sep}text.ts'`, `${sep}opt${sep}nish`, "; ModuleID = 'std/text.ts'".replace(/\//g, sep)],
    // Already relative: a compiler standing in its own root writes this, and it
    // is the form the other side is being brought to.
    [`; ModuleID = 'std${sep}text.ts'`, `${sep}opt${sep}nish`, `; ModuleID = 'std${sep}text.ts'`],
    // A neighbour whose name starts with the root's is not under it.
    [`${sep}opt${sep}nish-old${sep}std${sep}a.ts`, `${sep}opt${sep}nish`, `${sep}opt${sep}nish-old${sep}std${sep}a.ts`],
    // A trailing separator on the root must not remove one character more.
    [`${sep}opt${sep}nish${sep}std${sep}a.ts`, `${sep}opt${sep}nish${sep}`, `std${sep}a.ts`],
    // No root at all: every caller's fallback, and it must change nothing.
    [`${sep}opt${sep}nish${sep}std${sep}a.ts`, null, `${sep}opt${sep}nish${sep}std${sep}a.ts`],
  ];
  for (const [text, ownRoot, want] of cases) {
    const got = withoutOwnRoot(text, ownRoot);
    if (got !== want) {
      return `withoutOwnRoot(${JSON.stringify(text)}, ${JSON.stringify(ownRoot)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`;
    }
  }
  return null;
}

/**
 * `text` with one compiler's own version removed from the DWARF `producer`, so
 * `producer: "nish 0.6.0"` from the 0.6.0 seed and `producer: "nish 0.7.0"`
 * from a 0.7.0 HEAD both read `producer: "<own version>"`.
 *
 * `ownVersion` is the compiler's whole `--version` line, which is the string
 * `self/debug.ts` writes (`${CLI} ${VERSION}`), and the match carries both
 * quotes: a version that merely begins with it (`nish 0.6.0-rc.1`), the other
 * compiler's version, and the same words anywhere but a `producer:` are all
 * left alone. Nothing else is rewritten.
 */
function withoutOwnVersion(text, ownVersion) {
  if (ownVersion === undefined || ownVersion === null || ownVersion.length === 0) return text;
  return text.split(`producer: "${ownVersion}"`).join('producer: "<own version>"');
}

/**
 * `withoutOwnVersion` over inputs a corpus cannot produce, on every run, for
 * the reason `selfCheckRoots` gives: it is the other piece of comparison logic
 * here that can make two differing files look equal. Returns the reason it
 * failed, or null.
 */
function selfCheckVersions() {
  const unit = (producer) =>
    `!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "${producer}", isOptimized: false)`;
  const cases = [
    [unit("nish 0.6.0"), "nish 0.6.0", unit("<own version>")],
    // Another compiler's version is not this one's to forgive: a candidate
    // that records the reference's version, or a stale one, must still differ.
    [unit("nish 0.6.0"), "nish 0.7.0", unit("nish 0.6.0")],
    // A version that only begins with this one's is a different version.
    [unit("nish 0.6.0-rc.1"), "nish 0.6.0", unit("nish 0.6.0-rc.1")],
    // The same words outside a `producer:` are the program's, not the compiler's.
    ['@.str = private constant [10 x i8] c"nish 0.6.0"', "nish 0.6.0", '@.str = private constant [10 x i8] c"nish 0.6.0"'],
    // No version at all: every caller's fallback, and it must change nothing.
    [unit("nish 0.6.0"), null, unit("nish 0.6.0")],
    ["", "", ""],
  ];
  for (const [text, ownVersion, want] of cases) {
    const got = withoutOwnVersion(text, ownVersion);
    if (got !== want) {
      return `withoutOwnVersion(${JSON.stringify(text)}, ${JSON.stringify(ownVersion)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`;
    }
  }
  return null;
}

/** `git` in the repository, as `spawnSync` answers it: the caller reads the status. */
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * The release section `scripts/changelog-gen.mjs` would write for the commits
 * since the last release, as `{ text }`, or `{ error }` saying why it cannot
 * be read.
 *
 * It is the generator's own collect-and-render path, run as the generator's
 * own command line — without `--write`, which is the only flag that writes
 * anything — so the words a declaration is held to are the words the release
 * will print, and no second reading of a commit subject exists here to drift
 * from the first.
 *
 * The range is `<last v* tag>..HEAD`, which needs the history back to that tag
 * and the tag itself. A CI checkout has neither (`actions/checkout` fetches one
 * commit and no tags), and there the generator would not fail: `git describe`
 * would find no tag and it would render the fetched commits as a first
 * release. So the history is fetched when it is shallow, the tags when none is
 * reachable, and the answer is an error — never an empty section — when either
 * is still missing afterwards. A run with no release tag at all has no seed to
 * compare with either, since the seed *is* the last release.
 */
const pendingNotes = () => {
  const describe = () => git(["describe", "--tags", "--abbrev=0", "--match", "v*"]);
  const shallow = () => git(["rev-parse", "--is-shallow-repository"]).stdout.trim() === "true";
  if (shallow()) git(["fetch", "--quiet", "--unshallow", "--tags", "origin"]);
  else if (describe().status !== 0) git(["fetch", "--quiet", "--tags", "origin"]);
  if (shallow()) {
    return { error: "the checkout is shallow and `git fetch --unshallow` did not deepen it, so the commits since the last release cannot be read" };
  }
  const tag = describe();
  if (tag.status !== 0) {
    return { error: `no v* release tag is reachable from HEAD, even after fetching the tags: ${tag.stderr.trim()}` };
  }
  const rendered = spawnSync(process.execPath, [path.join(root, "scripts", "changelog-gen.mjs"), "--stdout", "md"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (rendered.status !== 0) {
    return { error: `scripts/changelog-gen.mjs could not render ${tag.stdout.trim()}..HEAD: ${rendered.stderr.trim()}` };
  }
  return { text: rendered.stdout };
};

/**
 * Whether a declaration's words are in the release notes: `CHANGELOG.md`, or
 * the pending section.
 *
 * `pending` is `pendingNotes()`'s answer, or null when it was never asked for
 * because every declaration was already named in `CHANGELOG.md`. Only its
 * rendered `text` counts: an error message that happens to quote the words —
 * the generator lists the unconventional subjects it skipped — is not the
 * release notes carrying them.
 */
const isNamed = (words, changelogText, pending) =>
  changelogText.includes(words) || (pending?.text?.includes(words) ?? false);

/**
 * `isNamed` over inputs no repository produces, on every run, for the reason
 * `selfCheckRoots` gives: it decides whether a declared difference is excused,
 * so a mistake in it passes a difference nobody wrote up. Returns the reason it
 * failed, or null.
 */
const selfCheckNotes = () => {
  const words = "Prove bounds through toI32(length)";
  const released = `## [0.7.0] - 2026-09-22\n\n### Performance\n\n- checker: ${words} (#154)\n`;
  const pending = { text: `### Performance\n\n- checker: ${words} (\`72a4b16\`)\n` };
  const cases = [
    // Released: the file carries it, whatever the pending notes say.
    [words, released, null, true],
    [words, released, { error: "shallow" }, true],
    // Unreleased: only the section the generator would render carries it.
    [words, "## [Unreleased]\n", pending, true],
    // In neither: the declaration does not hold.
    [words, "## [Unreleased]\n", { text: "### Tests\n\n- Something else\n" }, false],
    // The pending notes could not be read: never a pass, even though the
    // error text quotes the words the way the generator's stderr would.
    [words, "## [Unreleased]\n", { error: `skipped 1 commit: abc1234 ${words}` }, false],
    // Not asked for at all.
    [words, "## [Unreleased]\n", null, false],
  ];
  for (const [w, changelogText, notes, want] of cases) {
    const got = isNamed(w, changelogText, notes);
    if (got !== want) {
      return `isNamed(${JSON.stringify(w)}, ${JSON.stringify(changelogText)}, ${JSON.stringify(notes)}) is ${JSON.stringify(got)}, not ${JSON.stringify(want)}`;
    }
  }
  return null;
};

/**
 * A compiler as something spawnable: `cmd` plus the arguments that come before
 * the program's own. `label` is what the report calls it — the path as the
 * caller spelled it rather than the absolute one, so a summary line stays
 * readable and can be pasted back. `version` is its `--version` line, which
 * `withoutOwnVersion` removes from the DWARF `producer`.
 *
 * A compiler that cannot answer `--version` is refused here rather than three
 * hundred compilations later: a binary built for another platform or a `.js`
 * that is not a compiler fails in a way that names the path the caller gave.
 */
function resolveCompiler(spec, role) {
  const file = path.resolve(root, spec);
  const refuse = (why) => ({ error: `${role} ${spec} ${why}` });
  if (!fs.existsSync(file)) return refuse("does not exist");
  if (!fs.statSync(file).isFile()) return refuse("is not a file");
  const compiler = NODE_ENTRY.test(file)
    ? { label: spec, cmd: process.execPath, prefix: [file], packageRoot: packageRootOf(file) }
    : { label: spec, cmd: file, prefix: [], packageRoot: packageRootOf(file) };
  if (compiler.prefix.length === 0) {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      return refuse("is not executable (only .js/.mjs/.cjs are run under node)");
    }
  }
  const version = compile(compiler, ["--version"]);
  if (version.status !== 0) return refuse("is not runnable (`--version` failed)");
  return { ...compiler, version: (version.stdout ?? "").trim() };
}

/**
 * The seed `NISH_BOOTSTRAP` names, or null when there is none. An empty value
 * counts as none: `NISH_BOOTSTRAP= npm test` is how a caller turns the seed
 * off for one run, and reading it as a path would refuse to start instead.
 */
function seedFromEnvironment() {
  const seed = process.env.NISH_BOOTSTRAP;
  return seed === undefined || seed === "" ? null : seed;
}

/** Both compilers, or the first error. */
function resolvePair(referenceSpec, candidateSpec) {
  const reference = resolveCompiler(referenceSpec, "reference");
  if (reference.error !== undefined) return { error: reference.error };
  const candidate = resolveCompiler(candidateSpec, "candidate");
  if (candidate.error !== undefined) return { error: candidate.error };
  return { reference, candidate };
}

function compile(compiler, args) {
  return spawnSync(compiler.cmd, [...compiler.prefix, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** `--emit-header <dir>/<stem>.h ...`: the flags that ask for all four WP8 sidecars. */
function sidecarFlags(dir, stem) {
  return [
    "--emit-header",
    path.join(dir, `${stem}.h`),
    "--emit-dts",
    path.join(dir, `${stem}.d.ts`),
    "--emit-napi",
    path.join(dir, `${stem}.napi.c`),
  ];
}

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Every file under `dir` as `relative path -> bytes`, so a missing file is a difference too. */
function tree(dir) {
  const out = new Map();
  const walk = (at, prefix) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(at, entry.name);
      const rel = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else out.set(rel, fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
}

/** The first diagnostic of a compiler's stderr, without its file:line:col prefix. */
function firstLine(output) {
  const line = output.trim().split("\n")[0] ?? "";
  return line.replace(/^[^:]*:\d+:\d+: /, "");
}

/**
 * Where two texts differ, as at most `limit` lines with both spellings — the
 * shape `ir_oracle.js` reports, bounded because a release that changes one
 * attribute changes it in every module and the useful part of that report is
 * the first line of it, not the two million after.
 */
function excerpt(want, got, limit) {
  const wantLines = want.split("\n");
  const gotLines = got.split("\n");
  const total = Math.max(wantLines.length, gotLines.length);
  const shown = [];
  let differing = 0;
  for (let i = 0; i < total; i++) {
    if (wantLines[i] === gotLines[i]) continue;
    differing++;
    if (shown.length < limit) {
      shown.push(
        `line ${i + 1}: reference \`${wantLines[i] ?? "<end>"}\`\n` +
          `${" ".repeat(String(i + 1).length + 7)}candidate \`${gotLines[i] ?? "<end>"}\``
      );
    }
  }
  if (differing === 0) return { differing, total, text: "the bytes differ but no line does" };
  const more = differing > shown.length ? `\n... ${differing - shown.length} more differing line(s)` : "";
  return { differing, total, text: `${shown.join("\n")}${more}` };
}

/**
 * Compile one program with both compilers and compare everything they wrote.
 *
 * Returns exactly one of:
 *   `{ dump }`         — its own flags ask for a dump, so neither side writes an artefact
 *   `{ refused }`      — both compilers refuse it; the message is `reject_oracle.js`'s
 *   `{ differences }`  — `[{ surface, detail }]`, where `surface` is the file name or "exit"
 *   `{ files, lines, rooted, versioned }` — they agree, over this many files
 *                      and IR lines, this many of them only once each side's
 *                      own root, or own version, was removed
 *
 * The program is given the flags it is compiled with everywhere else, from its
 * `.args` sidecar or its `// smoke: args` line (`tests/self/corpus.js`): two
 * versions of one compiler disagree about a flag exactly as readily as about a
 * construct, and a program nobody compiles the way it is meant to be compiled
 * is not in the comparison at all.
 */
function compare(pair, work, file, options = {}) {
  const limit = options.lines ?? 3;
  const flags = extraArgs(file);
  const dump = flags.find((flag) => DUMP_FLAGS.has(flag));
  if (dump !== undefined) return { dump: `${dump}: no artefact; the <name>.stdout golden pins it` };

  // Both compilers name each module by the path they resolved it to and write
  // that path into the module header, so the entry has to be spelled the same
  // for both. The output directories differ and may: nothing either compiler
  // writes carries the directory it was written to.
  const named = path.relative(root, file);
  const stem = path.basename(file, ".ts");
  const referenceDir = fresh(path.join(work, "reference"));
  const candidateDir = fresh(path.join(work, "candidate"));
  const argv = (dir) => [
    named,
    "-o",
    `${dir}${path.sep}`,
    ...flags,
    ...(options.sidecars === false ? [] : sidecarFlags(dir, stem)),
  ];

  const reference = compile(pair.reference, argv(referenceDir));
  const candidate = compile(pair.candidate, argv(candidateDir));
  if (reference.status !== 0 && candidate.status !== 0) {
    return { refused: firstLine(reference.stderr) || `exit ${reference.status}` };
  }
  if (reference.status !== 0) {
    // A construct HEAD has and the seed does not is what the rolling freeze
    // *is*, and it is a difference like any other: `DECLARED` names it with
    // the CHANGELOG line that ships it, and the entry goes one release later,
    // when the seed has the construct.
    return {
      differences: [
        {
          surface: "exit",
          detail:
            `the candidate compiles it and the reference refuses it ` +
            `(reference: ${firstLine(reference.stderr) || `exit ${reference.status}`})`,
        },
      ],
    };
  }
  if (candidate.status !== 0) {
    return {
      differences: [
        {
          surface: "exit",
          detail: `the candidate refuses it: ${firstLine(candidate.stderr) || `exit ${candidate.status}`}`,
        },
      ],
    };
  }

  const want = tree(referenceDir);
  const got = tree(candidateDir);
  if (want.size === 0) return { refused: "the reference wrote no files" };
  const differences = [];
  let lines = 0;
  let rooted = 0;
  let versioned = 0;
  for (const name of [...new Set([...want.keys(), ...got.keys()])].sort()) {
    const a = want.get(name);
    const b = got.get(name);
    if (a === undefined) {
      differences.push({ surface: name, detail: "the candidate wrote it and the reference did not" });
      continue;
    }
    if (b === undefined) {
      differences.push({ surface: name, detail: "the reference wrote it and the candidate did not" });
      continue;
    }
    if (a.equals(b)) {
      if (name.endsWith(".ll")) lines += a.toString("utf8").split("\n").length;
      continue;
    }
    // The two compilers are installed in different directories — they have to
    // be — so a module either of them reached through its OWN package is named
    // by a path only that install can spell. Removing each side's own root
    // leaves the module's path relative to its own package, which is the
    // identity the comparison is actually about. Counted rather than folded in:
    // the summary says how many files agreed only this way, because a number
    // that says a comparison happened must say what it set aside.
    const wantText = a.toString("utf8");
    const gotText = b.toString("utf8");
    const wantRooted = withoutOwnRoot(wantText, pair.reference.packageRoot);
    const gotRooted = withoutOwnRoot(gotText, pair.candidate.packageRoot);
    if (wantRooted === gotRooted) {
      rooted++;
      if (name.endsWith(".ll")) lines += wantText.split("\n").length;
      continue;
    }
    // The reference is the last release and the candidate is HEAD, which
    // carries the next version from the commit that bumps it, so a `-g` build
    // records a different `producer` on each side. Counted apart for the same
    // reason as the root.
    if (
      withoutOwnVersion(wantRooted, pair.reference.version) === withoutOwnVersion(gotRooted, pair.candidate.version)
    ) {
      versioned++;
      if (name.endsWith(".ll")) lines += wantText.split("\n").length;
      continue;
    }
    const where = excerpt(wantText, gotText, limit);
    differences.push({
      surface: name,
      detail: `differs (${where.differing} of ${where.total} lines)\n${where.text}`,
    });
  }
  if (differences.length > 0) return { differences };
  return { files: want.size, lines, rooted, versioned };
}

/**
 * The declaration covering one difference, or null. Keyed on the program and
 * the file, both optional, so a declaration says exactly as much as its author
 * meant it to and no more.
 */
function declaredFor(program, surface) {
  for (const entry of DECLARED) {
    if (entry.program !== undefined && entry.program !== program) continue;
    if (entry.file !== undefined && entry.file !== surface) continue;
    return entry;
  }
  return null;
}

/**
 * Every positive whole program of the corpus, plus the whole programs of
 * `tests/link/`, which is where the multi-module shapes live — the same set
 * `ir_oracle.js` walks, from the same module, so the successor compares no
 * less than the oracle it replaces.
 */
function corpus() {
  return [...programs(), ...linkPrograms().map((program) => program.main)];
}

/**
 * The compiler HEAD builds: `self/compile.ts` linked into `build/self/compile`
 * by the seed, which is the arrangement G3 puts in `scripts/bootstrap.sh`.
 * There is no second answer: this is only called with a reference in hand,
 * and the reference is the seed (R6 took out the stage0 fallback that used to
 * sit here, which nothing could reach). Always rebuilt rather than
 * reused: a stale binary from an earlier checkout would be compared against
 * the release and reported as agreement, which is the one answer this tool
 * must never give by accident. Pass `--candidate` to compare a binary you
 * built yourself and skip this.
 */
function buildCandidate(seedSpec) {
  const out = path.join(root, "build", "self", "compile");
  const builder = resolveCompiler(seedSpec, "candidate builder");
  if (builder.error !== undefined) return { error: builder.error };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const built = compile(builder, [path.join("self", "compile.ts"), "--link", out]);
  if (built.status !== 0) return { error: `could not build the candidate with ${builder.label}\n${built.stderr}` };
  return { path: path.relative(root, out) };
}

const HELP = `nish-cmp — compile the corpus with two compilers and compare every byte.

usage: node tests/nish-cmp.js [options] [program.ts ...]

  -r, --reference <compiler>  the compiler that is trusted: the last released
                              nish (default: $NISH_BOOTSTRAP; without one the
                              run skips, because there is nothing to compare to)
  -c, --candidate <compiler>  the compiler under test (default: self/ built into
                              build/self/compile by the reference)
      --changelog <file>      where a released difference is named (default:
                              CHANGELOG.md); an unreleased one is named by the
                              section scripts/changelog-gen.mjs would render
                              for the commits since the last v* tag
      --no-sidecars           compare only the IR, not the four WP8 sidecars
      --lines <n>             differing lines to print per file (default: 3)
      --verbose               name every program, not only the differences
  -h, --help                  this text

A compiler is a native binary, or a .js/.mjs/.cjs entry point run under node —
the same rule scripts/bootstrap.sh applies to NISH_BOOTSTRAP.

With no programs named, the whole corpus is compared (tests/self/corpus.js).

exit codes: 0 agreed (or skipped for want of a seed), 1 undeclared difference,
2 usage or a compiler that would not build`;

function main(argv) {
  const options = { lines: 3, sidecars: true };
  let referenceSpec = seedFromEnvironment();
  let candidateSpec = null;
  let changelog = "CHANGELOG.md";
  let verbose = false;
  const named = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${HELP}\n`);
      return 0;
    } else if (arg === "-r" || arg === "--reference") referenceSpec = argv[++i];
    else if (arg === "-c" || arg === "--candidate") candidateSpec = argv[++i];
    else if (arg === "--changelog") changelog = argv[++i];
    else if (arg === "--no-sidecars") options.sidecars = false;
    else if (arg === "--lines") options.lines = Number(argv[++i]);
    else if (arg === "--verbose") verbose = true;
    else if (arg.startsWith("-")) {
      process.stderr.write(`nish-cmp: unknown option: ${arg}\n${HELP}\n`);
      return 2;
    } else named.push(arg);
  }
  if (referenceSpec === undefined || candidateSpec === undefined || Number.isNaN(options.lines)) {
    process.stderr.write(`nish-cmp: an option is missing its value\n${HELP}\n`);
    return 2;
  }

  // The skip, in the runner's own idiom (`tests/run.js`'s `skip`): one SKIP
  // line carrying the reason, and a summary that counts it rather than
  // reporting a comparison that did not happen as a pass. Nish has no release
  // yet, so this is the answer on every machine until 0.1.0 is tagged.
  if (referenceSpec === null) {
    process.stdout.write(
      "SKIP  nish-cmp: no seed available (no --reference and NISH_BOOTSTRAP is unset), " +
        "so HEAD was compared against nothing\n"
    );
    process.stdout.write("nish-cmp: 0 programs compared, 1 skipped (no seed available)\n");
    return 0;
  }

  // Before anything is compiled: the two pieces of comparison logic here that
  // can make two differing files look equal — each side's own root and each
  // side's own producer version — driven over inputs no corpus produces. A run whose own comparison is broken must say so instead of
  // agreeing about three hundred programs.
  const selfCheck = selfCheckRoots();
  if (selfCheck !== null) {
    process.stderr.write(`nish-cmp: its own package-root comparison is wrong: ${selfCheck}\n`);
    return 2;
  }
  const selfCheckVersion = selfCheckVersions();
  if (selfCheckVersion !== null) {
    process.stderr.write(`nish-cmp: its own producer-version comparison is wrong: ${selfCheckVersion}\n`);
    return 2;
  }
  const selfCheckNote = selfCheckNotes();
  if (selfCheckNote !== null) {
    process.stderr.write(`nish-cmp: its own release-note lookup is wrong: ${selfCheckNote}\n`);
    return 2;
  }

  // The corpus is settled before a compiler is built, so that a mistyped
  // program name costs a message rather than the link that precedes it.
  const inputs = named.length > 0 ? named.map((file) => path.resolve(file)) : corpus();
  const missing = inputs.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    process.stderr.write(`nish-cmp: no such program: ${missing.map((f) => path.relative(root, f)).join(", ")}\n`);
    return 2;
  }

  if (candidateSpec === null) {
    // The seed builds HEAD: that is the arrangement G3 wires into CI, and it
    // is why the reference is what gets passed on here. A seed too old to
    // compile HEAD's `self/` fails here, naming itself, which is the G4 policy
    // being enforced rather than discovered halfway through a comparison.
    const built = buildCandidate(referenceSpec);
    if (built.error !== undefined) {
      process.stderr.write(`nish-cmp: ${built.error}\n`);
      return 2;
    }
    candidateSpec = built.path;
  }
  const pair = resolvePair(referenceSpec, candidateSpec);
  if (pair.error !== undefined) {
    process.stderr.write(`nish-cmp: ${pair.error}\n`);
    return 2;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "nish-cmp-"));
  const undeclared = [];
  const declared = [];
  const dumps = [];
  const refused = [];
  let agreed = 0;
  let files = 0;
  let lines = 0;
  let rooted = 0;
  let versioned = 0;
  for (const file of inputs) {
    const program = path.relative(root, file);
    const result = compare(pair, work, file, options);
    if (result.dump !== undefined) {
      dumps.push(`${program}: ${result.dump}`);
    } else if (result.refused !== undefined) {
      refused.push(`${program}: both refuse it: ${result.refused}`);
    } else if (result.differences !== undefined) {
      for (const difference of result.differences) {
        const entry = declaredFor(program, difference.surface);
        const row = { program, ...difference, declared: entry };
        (entry === null ? undeclared : declared).push(row);
      }
    } else {
      agreed++;
      files += result.files;
      lines += result.lines;
      rooted += result.rooted ?? 0;
      versioned += result.versioned ?? 0;
      if (verbose) process.stdout.write(`  ok   ${program} (${result.files} files)\n`);
    }
  }
  fs.rmSync(work, { recursive: true, force: true });

  // A release that changes one attribute changes it in every module, so the
  // report is bounded twice over: `--lines` lines per file, and this many
  // files before the rest are counted rather than printed. The summary still
  // counts every one of them, and naming one program with a larger `--lines`
  // is how to look at a single difference closely.
  for (const row of undeclared.slice(0, MAX_ROWS)) {
    process.stdout.write(`  FAIL ${row.program}: ${row.surface} ${row.detail}\n`.replace(/\n(?=.)/g, "\n       "));
  }
  if (undeclared.length > MAX_ROWS) {
    process.stdout.write(`  ... ${undeclared.length - MAX_ROWS} more differing file(s), not printed\n`);
  }
  // A declaration is a claim that the release notes name the difference. The
  // claim is checked here rather than trusted, because the whole point of G2's
  // sentence is that the release note and the compiler's output cannot drift
  // apart: a declaration whose words have gone fails the run exactly as an
  // undeclared difference does. The pending section is only rendered when
  // `CHANGELOG.md` leaves a declaration unnamed, since it may have to fetch
  // history to do it.
  const changelogText = fs.existsSync(path.resolve(root, changelog))
    ? fs.readFileSync(path.resolve(root, changelog), "utf8")
    : "";
  const byReason = new Map();
  for (const row of declared) byReason.set(row.declared, (byReason.get(row.declared) ?? 0) + 1);
  const reasons = [...byReason.keys()];
  const pending = reasons.some((r) => !changelogText.includes(r.changelog)) ? pendingNotes() : null;
  const unnamed = reasons.filter((r) => !isNamed(r.changelog, changelogText, pending));
  for (const [reason, count] of byReason) {
    const where = `${reason.program ?? "every program"} ${reason.file ?? ""}`.trim();
    process.stdout.write(`declared: ${count} × ${where} — ${reason.why}\n`);
  }
  for (const reason of unnamed) {
    process.stdout.write(
      `  FAIL neither ${changelog} nor the pending release notes name this difference: the declaration asks ` +
        `for "${reason.changelog}"\n`
    );
  }
  if (unnamed.length > 0 && pending?.error !== undefined) {
    process.stdout.write(`  FAIL the pending release notes could not be read: ${pending.error}\n`);
  }
  // A declaration that covers nothing is not a failure — a single-program run
  // is entitled to match none of them — but it is worth saying on a full run,
  // because an allowlist nobody prunes is how the next real difference gets
  // waved through.
  if (named.length === 0) {
    for (const entry of DECLARED) {
      if (!byReason.has(entry)) {
        const where = `${entry.program ?? "every program"} ${entry.file ?? ""}`.trim();
        process.stdout.write(`note: nothing differs at ${where}; the declaration can go\n`);
      }
    }
  }
  if (verbose) {
    for (const row of refused) process.stdout.write(`  refused ${row}\n`);
    for (const row of dumps) process.stdout.write(`  dump ${row}\n`);
  }

  // Said on its own line rather than only inside the summary, because it is the
  // one thing this run compared less than literally, and a reader deciding what
  // a green line is worth should not have to know the flag names to find it.
  if (rooted > 0) {
    process.stdout.write(
      `note: ${rooted} file(s) agree once each compiler's own package root is removed ` +
        `(reference ${pair.reference.packageRoot}, candidate ${pair.candidate.packageRoot}): a module reached ` +
        `as \`nish/<name>\` is named by where that compiler's own \`std/\` is, which two installs cannot agree ` +
        `about. Every other byte of those files is compared as it stands.\n`
    );
  }

  if (versioned > 0) {
    process.stdout.write(
      `note: ${versioned} file(s) agree once each compiler's own version is removed from the DWARF ` +
        `producer (reference "${pair.reference.version}", candidate "${pair.candidate.version}"): a \`-g\` build ` +
        `records the version of the compiler that wrote it. Every other byte of those files is compared as it stands.\n`
    );
  }

  const compared = inputs.length - refused.length - dumps.length;
  // Each outcome is counted apart and named, for the reason the oracles count
  // their skips apart (`.claude/selfhost.md`): a program neither compiler
  // compiles proves nothing about either, and must not be able to hide inside
  // a number that reads like agreement.
  const refusedNote = refused.length > 0 ? `, ${refused.length} refused by both` : "";
  const dumpNote = dumps.length > 0 ? `, ${dumps.length} dumps (no artefact)` : "";
  const declaredNote = declared.length > 0 ? `, ${declared.length} declared difference(s)` : "";
  const rootedNote = rooted > 0 ? `, ${rooted} equal after each compiler's own root` : "";
  const versionedNote = versioned > 0 ? `, ${versioned} equal after each compiler's own producer version` : "";
  process.stdout.write(
    `nish-cmp: ${agreed}/${compared} programs agree (${files} files, ${lines} IR lines) — ` +
      `reference ${pair.reference.label}, candidate ${pair.candidate.label}` +
      `${refusedNote}${dumpNote}${rootedNote}${versionedNote}${declaredNote}, ${undeclared.length} undeclared difference(s)\n`
  );
  return undeclared.length === 0 && unnamed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export {
  buildCandidate,
  compare,
  corpus,
  packageRootOf,
  resolveCompiler,
  resolvePair,
  seedFromEnvironment,
  selfCheckNotes,
  selfCheckRoots,
  selfCheckVersions,
  isNamed,
  withoutOwnRoot,
  withoutOwnVersion,
};
