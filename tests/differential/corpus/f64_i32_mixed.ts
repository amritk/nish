// --number-mode f64 with explicit i32 locals: they still wrap; toI32 from f64 saturates.
function wrapping(n: i32): i32 {
  return n * 3 + 1;
}

export function main(): void {
  const big: i32 = 2147483647;
  console.log(wrapping(big));
  console.log(big + 1);
  let counter: i32 = 2147483640;
  for (let i = 0; i < 10; i++) {
    counter++;
  }
  console.log(counter);
  console.log(toI32(5e10));
  console.log(toI32(-5e10));
  console.log(toI32(2147483647.9));
  console.log(toI32(-2147483648.9));
  console.log(toI32(3.99));
  console.log(toI32(-3.99));
  const zero = 0;
  console.log(toI32(zero / zero));
  console.log(toI32(1e308 * 10));
  console.log(toF64(big) * 2);
  console.log(toF64(counter) / 4);
  const half = 0.5;
  console.log(toI32(half) + big);
  console.log(toI64(1e19));
  console.log(toI64(-1e19));
  console.log(toI64(9007199254740993));
  console.log(toI64(-0.99));
  console.log(toF64(toI64(1e18)) / 7);
  const k: i32 = 46341;
  console.log(k * k);
  console.log(toF64(k) * toF64(k));
  console.log(`${big} ${toF64(big)} ${toI32(3.7)}`);
}
