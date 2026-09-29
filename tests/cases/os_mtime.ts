// WP34 N3: `statMtimeSync(path)` is Node's `mtimeMs`: milliseconds, with the
// sub-millisecond fraction the file system keeps, or NaN for a path that
// cannot be stat'd (a scalar has no null). A directory has a time of its own.
// The `os_` block of tests/run.js runs this with the path of a file whose
// mtime it set to a fraction of a millisecond, under Node and natively, and
// requires both to print Node's `mtimeMs` for it.
export const main = (): i32 => {
  const missing = statMtimeSync("tests/cases/os_mtime.missing");
  console.log(missing !== missing);
  const dir = statMtimeSync("tests/cases");
  console.log(dir === dir && dir > 0.0);
  if (process.argv.length > 1) {
    console.log(statMtimeSync(process.argv[1]));
  }
  return 0;
};
