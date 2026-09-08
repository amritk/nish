// parseInt / parseFloat / Number (WP7): string-to-number parsing in the
// runtime (amrit_parse_number) with JavaScript semantics for the decimal forms,
// plus the documented deviations: parseInt has no NaN (0 without digits) and
// saturates into i32; parseFloat reads a `0x` prefix as hex like strtod.
function show(label: string, v: f64): void {
  console.log(`${label} = ${v}`);
}

export function main(): number {
  console.log(`parseInt("42") = ${parseInt("42")}`);
  console.log(`parseInt("  -17abc") = ${parseInt("  -17abc")}`);
  console.log(`parseInt("+3.99") = ${parseInt("+3.99")}`);
  console.log(`parseInt("1e5") = ${parseInt("1e5")}`);
  console.log(`parseInt("0x10") = ${parseInt("0x10")}`);
  console.log(`parseInt("abc") = ${parseInt("abc")}`);
  console.log(`parseInt("") = ${parseInt("")}`);
  console.log(`parseInt("99999999999") = ${parseInt("99999999999")}`);
  console.log(`parseInt("-99999999999") = ${parseInt("-99999999999")}`);
  console.log(`parseInt("-2147483648") = ${parseInt("-2147483648")}`);

  show('parseFloat("3.14xyz")', parseFloat("3.14xyz"));
  show('parseFloat(".5")', parseFloat(".5"));
  show('parseFloat("-1e3")', parseFloat("-1e3"));
  show('parseFloat("  1e")', parseFloat("  1e"));
  show('parseFloat("1.5e+")', parseFloat("1.5e+"));
  show('parseFloat("Infinityx")', parseFloat("Infinityx"));
  show('parseFloat("-Infinity")', parseFloat("-Infinity"));
  show('parseFloat("inf")', parseFloat("inf"));
  show('parseFloat("abc")', parseFloat("abc"));
  show('parseFloat("")', parseFloat(""));
  show('parseFloat(".")', parseFloat("."));
  show('parseFloat("0.1")', parseFloat("0.1"));
  show('parseFloat("1e400")', parseFloat("1e400"));

  show('Number("42")', Number("42"));
  show('Number("")', Number(""));
  show('Number("   ")', Number("   "));
  show('Number("  7.5  ")', Number("  7.5  "));
  show('Number("12px")', Number("12px"));
  show('Number("1e3")', Number("1e3"));
  show('Number("-.5")', Number("-.5"));
  show('Number("0x1A")', Number("0x1A"));
  show('Number("Infinity")', Number("Infinity"));
  show('Number("Infinityx")', Number("Infinityx"));
  show('Number("nan")', Number("nan"));
  show('Number(".")', Number("."));
  show('Number("1e")', Number("1e"));

  let big: i64 = 9007199254740992; // 2^53; the next integer is not representable in f64
  big = big + 1;
  show("Number(true)", Number(true));
  show("Number(false)", Number(false));
  show("Number(7)", Number(7));
  show("Number(-2.5)", Number(-2.5));
  show("Number(big)", Number(big));
  const n: number = 12;
  show("Number(n) / 5", Number(n) / 5);
  return 0;
}
