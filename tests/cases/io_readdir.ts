// `readdirSync`: a directory's entries, sorted by bytes and without `.` or `..`.
//
// The case builds the directory it lists, so the golden does not depend on the
// repository's layout, and creates every level itself because `mkdirSync` is not
// recursive. `b.txt` is written before `a.txt` on purpose: the order below is the
// listing's own, not the order the file system happened to store them in.
export const main = (): number => {
  mkdirSync("build");
  const dir = "build/io_readdir";
  mkdirSync(dir);
  mkdirSync(`${dir}/sub`);
  writeFileSync(`${dir}/b.txt`, "b");
  writeFileSync(`${dir}/a.txt`, "a");
  writeFileSync(`${dir}/.hidden`, "h");

  const entries = readdirSync(dir);
  if (entries === null) {
    console.log("unreadable");
    return 1;
  }
  // A dotfile is an entry, so the count is four and `.hidden` sorts first.
  console.log(`${entries.length}: ${entries.join(",")}`);

  // An empty directory is an empty array, which is not the `null` that
  // io_readdir_null.ts pins.
  const empty = readdirSync(`${dir}/sub`);
  if (empty === null) {
    console.log("sub unreadable");
    return 1;
  }
  console.log(`empty: ${empty.length}`);
  return 0;
};
