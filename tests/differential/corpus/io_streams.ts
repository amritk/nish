// `console.error`, the newline-free writes, and `readFileSyncOrNull` against
// Node: the runner compares stdout and stderr separately, so the interleaving
// of the two streams is what this pins.
export function main(): number {
  write("one");
  write(" two");
  write("\n");
  console.log("log line");
  console.error("error line");
  writeError("err ");
  writeError("no newline\n");
  const missing = readFileSyncOrNull("./tests/differential/corpus/does-not-exist");
  console.log(`missing: ${missing === null}`);
  const here = readFileSyncOrNull("./tests/differential/corpus/io_streams.ts");
  if (here === null) {
    console.log("unexpectedly missing");
  } else {
    console.log(`self: ${here.startsWith("// `console.error`")}`);
  }
  return 0;
}
