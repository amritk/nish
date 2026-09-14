// WP21 S2: a package whose `exports` names a **directory** where a file
// belongs — `"nish": "./src"` rather than `"./src/index.ts"`, which is the
// ordinary slip of someone used to a resolver that would have looked inside.
//
// The target passes `manifest.ts`'s rules (it begins with `./`, climbs nowhere,
// carries no escape), so the resolver is sent to a path that opens and is not a
// file. That is one of exactly two things a `package.json` can now steer either
// compiler at, and it is the reason `nish_read_file_or_null` guards with
// `S_ISREG`: `open(O_RDONLY)` accepts a directory, `lseek` answers `LONG_MAX`,
// and stage1 died with `out of memory` where stage0 reported a missing module.
// Both now answer the same sentence at the specifier, which is what this case
// pins — `tests/run.js` through stage0 and `tests/self/reject_oracle.js`
// through stage1, since every `tests/link` negative goes through both.
import { seed } from "pkg_dir_target";

export const main = (): i32 => seed();
