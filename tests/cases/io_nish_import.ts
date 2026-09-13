// The `nish:` modules: the libc-backed builtins reached by an import instead
// of as globals. Every call here has a global twin in `io_streams` and
// `io_files`, and it lowers to the same IR — the import renames a builtin, it
// does not add one, which `tests/run.js` proves against `io_nish_import_global.ts`.
import { readFileSync, writeFileSync } from "nish:fs";
import { argv } from "nish:process";
import { write } from "nish:io";

export const main = (): number => {
  writeFileSync("build/test/io_nish_import.txt", "imported\n");
  write(readFileSync("build/test/io_nish_import.txt"));
  write(`argv: ${argv.length > 0}\n`);
  return 0;
};
