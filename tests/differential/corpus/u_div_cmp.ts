// Unsigned division, remainder and ordering. Every value here is above
// INT_MAX in its width, which is precisely where `udiv` and `icmp ult` differ
// from the signed instructions: as an i32, 4000000000 is negative.
function divU32(a: u32, b: u32): u32 {
  return a / b;
}

function ltU32(a: u32, b: u32): boolean {
  return a < b;
}

export function main(): number {
  const big: u32 = 4000000000;
  const small: u32 = 7;
  console.log(`${divU32(big, small)}`);
  console.log(`${big % small}`);
  console.log(`${divU32(big, big)}`);
  console.log(`${divU32(small, big)}`);
  console.log(`${small % big}`);

  console.log(`${ltU32(big, small)}`);
  console.log(`${ltU32(small, big)}`);
  console.log(`${big > 2147483647}`);
  console.log(`${big >= big}`);
  console.log(`${small <= big}`);

  const b: u8 = 200;
  const d: u8 = 3;
  console.log(`${b / d}`);
  console.log(`${b % d}`);
  console.log(`${b > 127}`);

  const h: u16 = 50000;
  console.log(`${h / 7}`);
  console.log(`${h % 7}`);
  console.log(`${h > 32767}`);

  const q: u64 = toU64(0) - toU64(1); // 2^64 - 1
  const three: u64 = 3;
  console.log(`${q / three}`);
  console.log(`${q % three}`);
  console.log(`${q > three}`);

  // A loop whose counter passes INT_MAX: the unsigned compare keeps going.
  let n: u32 = 4294967290;
  let steps: u32 = 0;
  while (n > 4294967280) {
    n = n - 2;
    steps = steps + 1;
  }
  console.log(`${n} ${steps}`);
  return 0;
}
