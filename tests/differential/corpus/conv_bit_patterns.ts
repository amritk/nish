export function main(): number {
  const values: f64[] = [0.0, 1.0, -1.0, 0.5, 3.141592653589793, 1e308, 1e-308];
  for (const v of values) {
    const bits: i64 = f64ToBits(v);
    console.log(bits);
    console.log(bitsToF64(bits) === v);
  }
  // The sign of zero survives a round trip through the bits, which is the
  // whole point: `-0.0 === 0.0` is true but their bit patterns differ.
  console.log(f64ToBits(-0.0) < 0);
  console.log(f64ToBits(0.0) === 0);
  return 0;
}
