// A legacy octal literal, alone, with a fraction after it, and with a
// separator after it; tsc: TS1121, once for each literal, naming the `0o`
// spelling of its octal digits (issue #271).
export const main = (): i32 => {
  const fifteen: i32 = 017;
  const x: f64 = 017.5;
  const y: i32 = 07_1;
  console.log(`${fifteen} ${x} ${y}`);
  return 0;
};
