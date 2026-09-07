// `console.error` and the newline-free `write` / `writeError` (WP14 B2), plus
// `readFileSyncOrNull` (B3), whose `null` is what lets a program report a
// missing file itself instead of exiting inside the read.
export function main(): number {
  write("no");
  write(" newline");
  write("\n");
  console.error("diagnostic");
  writeError("partial ");
  writeError("line\n");
  const missing = readFileSyncOrNull("build/test/io_streams_absent.txt");
  console.log(`missing: ${missing === null}`);
  writeFileSync("build/test/io_streams.txt", "present\n");
  const text = readFileSyncOrNull("build/test/io_streams.txt");
  if (text === null) {
    panic("readFileSyncOrNull lost a file it had just written");
  } else {
    console.log(`found ${text.length} bytes`);
  }
  return 0;
}
