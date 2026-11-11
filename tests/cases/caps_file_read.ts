// WP44 §9 Q8: all four file-window builtins are `fs.read`. Each exported
// wrapper calls one of them and is listed with `fs.read` and a one-call
// witness naming it; `main` reaches all four, and its witness runs through
// `openFile`, the first it calls. `reject_file_read_denied` is the refusal
// under `--deny fs.read`.
export const openFile = (path: string): i32 => fileOpen(path);

export const readWindow = (fd: i32, into: u8[], pos: i64): i32 => fileReadAt(fd, into, 0, into.length, pos);

export const sizeOf = (fd: i32): i64 => fileSize(fd);

export const closeFile = (fd: i32): i32 => fileClose(fd);

export const main = (): number => {
  const fd = openFile("tests/cases/caps_file_read.ts");
  const one: u8[] = new Array<u8>(1);
  const pos: i64 = 0;
  const n = readWindow(fd, one, pos);
  console.log(`${n} ${one[0]} ${sizeOf(fd) > pos} ${closeFile(fd)}`);
  return 0;
};
