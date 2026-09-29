// WP34 N3: `Date.now()` is the wall clock in whole milliseconds since the
// epoch, an f64 in either number mode. The two facts printed hold on any day;
// the `os_` block of tests/run.js runs this again with an argument, and holds
// the reading it prints between two readings of Node's own `Date.now()`.
export const main = (): i32 => {
  const t: f64 = Date.now();
  console.log(t === Math.floor(t));
  console.log(t > 1.7e12);
  if (process.argv.length > 1) {
    console.log(t);
  }
  return 0;
};
