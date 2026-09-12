// The same rule as `mem_getenv_scope`, for `readdirSync`: the array and every
// string in it are arena allocations, so a function that returns the listing gets
// no automatic arena scope. Reading `entries[0]` after 320 bytes of allocation is
// what a rewound arena would corrupt.
const listOf = (dir: string): string[] | null => {
  const label = `list ${dir}`;
  console.log(label);
  return readdirSync(dir);
};

export const main = (): number => {
  mkdirSync("build");
  const dir = "build/mem_readdir_scope";
  mkdirSync(dir);
  writeFileSync(`${dir}/only.txt`, "x");
  const entries = listOf(dir);
  if (entries === null) {
    console.log("unreadable");
    return 1;
  }
  let filler = "";
  for (let i = 0; i < 40; i++) {
    filler = `${filler}ZZZZZZZZ`;
  }
  console.log(`filled ${filler.length}`);
  console.log(`first: ${entries[0]}`);
  return 0;
};
