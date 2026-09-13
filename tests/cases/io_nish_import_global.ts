// The twin of `io_nish_import`, written with the global spelling. The pair is
// compared by `tests/run.js`: an import must be the same builtin, so the two
// modules have to emit the same IR body, and a lowering that ever depended on
// which spelling a program used would show up here as a diff.
export const main = (): number => {
  writeFileSync("build/test/io_nish_import.txt", "imported\n");
  write(readFileSync("build/test/io_nish_import.txt"));
  write(`argv: ${process.argv.length > 0}\n`);
  return 0;
};
