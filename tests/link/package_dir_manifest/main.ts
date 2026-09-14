// WP21 S2: a `node_modules/<name>` whose `package.json` is a **directory**.
//
// The walk asks each candidate directory for its manifest by *reading* it, in
// both compilers, so a manifest that opens and is not a file is not a manifest
// and the walk carries on past it — ending at `` Cannot find package ``, the
// same sentence from each. It went differently in three ways before: stage0
// stopped at the candidate because it asked `stat` rather than reading, and
// stage1 asked `nish_read_file_or_null`, which opened the directory, took
// `LONG_MAX` from `lseek` and died with `out of memory`. One tree, three
// answers, none of them shared.
import { seed } from "pkg_dir_manifest";

export const main = (): i32 => seed();
