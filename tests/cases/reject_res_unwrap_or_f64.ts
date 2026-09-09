// The fallback is checked with no contextual type, so in f64 mode a bare `-1`
// is an `f64` and does not match a `Result<i32, string>`. `docs/LANGUAGE.md`
// grants a literal its context's type only in the positions its table names,
// and this is not one of them — write `toI32(-1)` when the fallback has to be
// an i32. `tests/run.js --parity` is what found the two compilers disagreeing
// here (WP19 G1): stage1 was threading the success type down as a hint.
function port(text: string): Result<i32, string> {
  const n = parseInt(text);
  if (n <= 0) {
    return Err("not a port");
  }
  return Ok(n);
}

export function main(): i32 {
  console.log(port("nope").unwrapOr(-1));
  return 0;
}
