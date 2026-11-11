// WP44 §9 Q8: `fileOpen` and `fileReadAt` are `fs.read`, so a policy that
// denies it refuses the program before any IR is written (NL2459).
export const main = (): number => {
  const fd = fileOpen("tests/cases/reject_file_read_denied.ts");
  const buf: u8[] = new Array<u8>(4);
  const pos: i64 = 0;
  return fileReadAt(fd, buf, 0, 4, pos);
};
