// `dump_checked <file>`: the side tables stage1's checker filled in, printed in
// the format `amritc --emit-checked` prints them.
//
// This is how S3 is tested (docs/wp14-selfhost.md §6 rule 3):
// `tests/self/checked_oracle.js` runs stage0 with `--emit-checked` over the
// same program, keeps the lines the checker is responsible for, and diffs.
//
// The dump itself is `self/dump.ts`, which `self/compile.ts --emit-checked`
// prints too: this file is only the command line the oracle spawns.

import { Compilation } from "./compilation";
import { NUMBER_MODE_F64, NUMBER_MODE_I32 } from "./context";
import { checkedText } from "./dump";
import { Options } from "./options";

export function main(): number {
  if (process.argv.length < 2) {
    console.error("usage: dump_checked [--number-mode f64] <file>");
    return 2;
  }
  const opts = new Options();
  let path = "";
  let arg = 1;
  while (arg < process.argv.length) {
    const value = process.argv[arg];
    if (value === "--number-mode") {
      arg = arg + 1;
      if (arg < process.argv.length && process.argv[arg] === "f64") {
        opts.numberMode = NUMBER_MODE_F64;
      } else {
        opts.numberMode = NUMBER_MODE_I32;
      }
    } else {
      path = value;
    }
    arg = arg + 1;
  }
  if (path.length === 0) {
    console.error("usage: dump_checked [--number-mode f64] <file>");
    return 2;
  }

  const compilation = new Compilation(opts);
  // `load` parses every module, sweeps it with Phase 0 and collects its
  // signatures, so a forbidden construct or an unreadable module is answered
  // before anything is bound; `check` binds the imports and checks the bodies.
  if (!compilation.load(path)) {
    if (compilation.sink.hasErrors()) {
      writeError(`${compilation.sink.format(20)}\n`);
    }
    return 1;
  }
  if (!compilation.check()) {
    writeError(`${compilation.sink.format(20)}\n`);
    return 1;
  }

  write(checkedText(compilation));
  return 0;
}
