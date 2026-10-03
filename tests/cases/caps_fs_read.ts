// WP35: `readFileSync` is `fs.read`. `main` reaches it through `sizeOf`, a
// private helper, so its witness is two calls long and names the helper; the
// helper itself is not listed, because only what is exported is. `half`
// reaches nothing and is listed with no capability at all.
const sizeOf = (path: string): i32 => readFileSync(path).length;

export const half = (n: i32): i32 => n / 2;

export const main = (): number => {
  console.log(sizeOf("tests/cases/caps_fs_read.ts") > 0);
  console.log(half(42));
  return 0;
};
