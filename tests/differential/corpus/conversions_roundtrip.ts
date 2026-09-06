// toI32 / toI64 / toF64 in every direction: round trips, saturation, wrapping, rounding.
function roundTrip32(x: number): boolean {
  return toI32(toF64(x)) === x;
}

function roundTrip64(x: i64): boolean {
  return toI64(toF64(x)) === x;
}

export function main(): number {
  const max = 2147483647;
  const min = -2147483647 - 1;
  console.log(roundTrip32(max));
  console.log(roundTrip32(min));
  console.log(roundTrip32(0));
  console.log(roundTrip32(-1));
  let big: i64 = 4503599627370496;
  big = big * 2;
  console.log(roundTrip64(big));
  console.log(roundTrip64(big + 1));
  console.log(roundTrip64(big + 2));
  console.log(toF64(big + 1));
  console.log(toF64(big + 3));
  console.log(toF64(big * 1024 + 1));
  console.log(toI32(toI64(max) + 1));
  console.log(toI32(toI64(min) - 1));
  console.log(toI32(big));
  console.log(toI32(big * 3 + 12345));
  console.log(toI64(toI32(big * 3 + 12345)));
  const f: f64 = 2.75;
  console.log(toI32(f));
  console.log(toI32(-f));
  console.log(toI64(f * 1e9));
  console.log(toI64(-f * 1e9));
  console.log(toI32(f * 1e12));
  console.log(toI32(-f * 1e12));
  console.log(toI64(f * 1e30));
  console.log(toI64(-f * 1e30));
  const z: f64 = 0;
  console.log(toI32(z / z));
  console.log(toI64(z / z));
  console.log(toI32(1 / z));
  console.log(toI64(-1 / z));
  console.log(toF64(toI32(f)) + f);
  console.log(toF64(7) / toF64(2));
  console.log(toF64(min) - 1);
  console.log(toF64(max) + 1);
  console.log(toI32(toF64(max) + 1));
  const nearMax: f64 = 2147483647.5;
  console.log(toI32(nearMax));
  console.log(toI32(-nearMax - 1));
  const i64max: f64 = 9223372036854775807;
  console.log(toI64(i64max));
  console.log(toI64(-i64max));
  const e19: f64 = 1e19;
  console.log(toI64(e19));
  let acc: i64 = 0;
  for (let i = 0; i < 100; i++) {
    acc += toI64(i * i);
  }
  console.log(acc);
  console.log(toI32(acc) === 328350);
  return 0;
}
