// WP15: `String(x)` prints the fewest digits that read back as the same double,
// and "fewest" is not the same as "correctly rounded to that many digits". For
// these values the correctly-rounded 16-digit string does not round-trip but a
// neighbouring 16-digit string does, so the old snprintf/strtod search gave up
// and printed all seventeen. Ryu finds the shortest one, which is what Node
// prints and what this pins.
export function main(): i32 {
  const a: f64 = 7.120236347223045e-307;
  const b: f64 = 7.291122019556398e-304;
  const c: f64 = 8.209073602596753e-289;
  const d: f64 = 5.641232424577593e-278;
  // Ordinary values, to keep the common path honest alongside the rare one.
  const e: f64 = 0.1;
  const f: f64 = 1e21;
  const g: f64 = 5e-324;
  console.log(`${a}`);
  console.log(`${b}`);
  console.log(`${c}`);
  console.log(`${d}`);
  console.log(`${e}`);
  console.log(`${f}`);
  console.log(`${g}`);
  return 0;
}
