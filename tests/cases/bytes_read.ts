// WP34 N2: `readFileBytesSync` answers the file's bytes with no UTF-8 assumed:
// the fixture holds a zero byte, 0x7f, 0x80, 0xff, a newline and the invalid
// pair 0xc3 0x28, and every one comes back as it is on disk. A file that is not
// there is `null`. In f64 mode with a `main`, so the unmodified-Node run
// compares the output too; both run from the repository root.
export const main = (): i32 => {
  const bytes = readFileBytesSync("tests/cases/bytes_read.bin");
  if (bytes === null) {
    console.log("missing");
    return 1;
  }
  const parts: string[] = [];
  for (const b of bytes) {
    parts.push(`${b}`);
  }
  console.log(`${bytes.length}: ${parts.join(" ")}`);
  const gone = readFileBytesSync("tests/cases/bytes_read.missing");
  console.log(gone === null ? "null" : "bytes");
  const dir = readFileBytesSync("tests/cases");
  console.log(dir === null ? "null" : "bytes");
  return 0;
};
