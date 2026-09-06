// String-to-number parsing without the command line: whitespace, signs,
// exponents, Infinity, blank strings and garbage, plus Number on the other
// primitive types.
function report(s: string): void {
  console.log(`[${s}] -> ${parseInt(s)} | ${parseFloat(s)} | ${Number(s)}`);
}

export function main(): number {
  report("42");
  report("  -17abc");
  report("+3.99");
  report("1e5");
  report("");
  report("   ");
  report(".");
  report("-.5e-3");
  report("1.5e+");
  report("Infinity");
  report("-Infinity!");
  report("12 34");
  report("0.1");
  report("2147483648");
  report("-2147483649");
  const flag = true;
  const n: number = 5;
  const big: i64 = 1234567890123;
  const x: f64 = 0.5;
  console.log(`${Number(flag)} ${Number(n)} ${Number(big)} ${Number(x)}`);
  return parseInt("7");
}
