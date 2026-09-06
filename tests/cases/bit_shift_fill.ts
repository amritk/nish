// What the shifts compute at run time. `>>` fills with the sign bit and `>>>`
// fills with zeros, so they differ on a negative operand; `-1 >>> 0` is `-1`
// here and `4294967295` in JavaScript, because `i32` is signed and the raw
// bits are read back as the type they are in. A count of 32 or 33 is masked to
// 0 or 1, so neither is undefined behaviour.
function test(): number {
  const negative = -16;
  console.log(negative >> 2);
  console.log(negative >>> 28);
  console.log(-1 >>> 0);
  console.log(1 << 32);
  console.log(1 << 33);
  return negative >> 4;
}
