#!/usr/bin/env -S nish run
// A `#!` line at offset 0 is trivia, so a program is a script: `chmod +x` it
// and `./entry_shebang.ts` runs through `nish run`. The lexer skips the line
// and nothing else, so the IR is the IR of the same file without it.
export const main = (): number => {
  console.log("run as a script");
  return 0;
};
