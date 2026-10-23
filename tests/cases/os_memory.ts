// WP34 N12: `totalMemory()` is the host's physical memory in bytes, an i64,
// or -1 where it cannot be read. The `os_` block of tests/run.js runs this
// again with an argument and holds the size it prints to Node's `os.totalmem()`.
export const main = (): number => {
  const bytes = totalMemory();
  console.log(bytes > 0);
  if (process.argv.length > 1) {
    console.log(bytes);
  }
  return 0;
};
