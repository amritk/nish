#!/usr/bin/env -S nish run
// The skipped shebang keeps its newline, so an error below it is reported on
// the line the file has it on: line 5, column 10.
export const main = (): number => {
  return "not a number";
};
