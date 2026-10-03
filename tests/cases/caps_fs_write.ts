// WP35: `writeFileSync` is `fs.write`, reached from `main` through `save`.
// The file is read back with `readFileSync`, which is `fs.read` and a second
// witness of its own, so one function carries two capabilities and the report
// lists them in the fixed order.
const save = (path: string, text: string): void => {
  writeFileSync(path, text);
};

export const main = (): number => {
  const path = "build/test/caps_fs_write.txt";
  save(path, "written\n");
  console.log(readFileSync(path));
  return 0;
};
