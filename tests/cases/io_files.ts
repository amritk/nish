// writeFileSync / appendFileSync / readFileSync. The path is relative to the
// working directory (the test harness runs from the repository root).
export function main(): number {
  const path = "build/test/io_files.txt";
  writeFileSync(path, "hello\n");
  appendFileSync(path, "world\n");
  const text = readFileSync(path);
  console.log(text.length);
  console.log(text);
  return 0;
}
