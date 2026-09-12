// The other half of `readdirSync`: `null` when there is no directory to list.
// It is a different answer from the empty array an empty directory gives
// (io_readdir), which is the whole reason the type is `string[] | null` — and the
// narrowing is the ordinary one, so the result cannot be indexed unchecked.
export const main = (): number => {
  mkdirSync("build");
  writeFileSync("build/io_readdir_null.txt", "not a directory");
  console.log(`missing: ${readdirSync("build/no-such-directory") === null}`);
  console.log(`plain file: ${readdirSync("build/io_readdir_null.txt") === null}`);
  return 0;
};
