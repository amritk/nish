// `f64ToBits`/`bitsToF64` reinterpret the 64 bits rather than converting the
// value: `toI64(1.5)` is 1, `f64ToBits(1.5)` is the IEEE-754 pattern. A
// compiler emitting LLVM IR needs this, because LLVM only accepts decimal
// float literals that round-trip exactly. Both lower to one `bitcast`, so a
// function that only reinterprets bits stays `readnone`.
function bitsOf(x: f64): i64 {
  return f64ToBits(x);
}

function valueOf(b: i64): f64 {
  return bitsToF64(b);
}

export function main(): number {
  console.log(bitsOf(0.0));
  console.log(bitsOf(1.0));
  console.log(bitsOf(-2.0));
  console.log(valueOf(bitsOf(3.141592653589793)));
  console.log(valueOf(bitsOf(-0.5)) === -0.5);
  // The sign bit survives the round trip through an integer, which is the
  // property that makes -0.0 distinguishable from 0.0 here but not with `===`.
  console.log(bitsOf(-0.0) < 0);
  return 0;
}
