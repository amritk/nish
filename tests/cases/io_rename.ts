// `renameSync(from, to)` is rename(2): `to` is replaced in one step, so a
// reader sees the old file or the new one and never a half-written mix, and
// `from` is gone afterwards. A failure is an answer, not an exit: a missing
// source is -2 (`ENOENT`) and the program carries on. Across file systems the
// answer would be -18 (`EXDEV`), which no fixture here can reach.
export function main(): number {
  const from = "build/test/io_rename_from.txt";
  const to = "build/test/io_rename_to.txt";
  writeFileSync(to, "old");
  writeFileSync(from, "new");
  console.log(`rename: ${renameSync(from, to)}`);
  console.log(`target: ${readFileSync(to)}`);
  console.log(`source gone: ${readFileSyncOrNull(from) === null}`);
  console.log(`missing source: ${renameSync(from, to)}`);
  console.log(`target kept: ${readFileSync(to)}`);
  return 0;
}
