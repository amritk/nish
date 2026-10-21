// WP34 N12: `availableParallelism()` is the number of cores the program may
// run on, at least 1, with or without `--threads`. The `os_` block of
// tests/run.js runs this under NISH_NUM_THREADS=1 too and requires 1.
export const main = (): number => {
  const n = availableParallelism();
  console.log(n >= 1);
  if (process.argv.length > 1) {
    console.log(n);
  }
  return 0;
};
