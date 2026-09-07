// Unsigned arithmetic at every width: wrapping `+ - *` at the top of each
// range, and values above INT_MAX that a signed type could not hold.
function mulU32(a: u32, b: u32): u32 {
  return a * b;
}

export function main(): number {
  const b0: u8 = 255;
  console.log(`${b0 + 1}`);
  console.log(`${b0 * 2}`);
  console.log(`${b0 - 255}`);
  const b1: u8 = 0;
  console.log(`${b1 - 1}`);
  console.log(`${b1 - 200}`);

  const h0: u16 = 65535;
  console.log(`${h0 + 1}`);
  console.log(`${h0 * 3}`);
  const h1: u16 = 0;
  console.log(`${h1 - 1}`);

  const w0: u32 = 4294967295;
  console.log(`${w0}`);
  console.log(`${w0 + 1}`);
  console.log(`${w0 - 4294967295}`);
  const w1: u32 = 0;
  console.log(`${w1 - 1}`);
  console.log(`${mulU32(65536, 65536)}`);
  console.log(`${mulU32(3000000000, 3)}`);
  console.log(`${mulU32(123456789, 987654321)}`);

  const q0: u64 = 0;
  const one: u64 = 1;
  console.log(`${q0 - one}`);
  console.log(`${q0 - one - one}`);
  const q1: u64 = 4294967295;
  console.log(`${q1 * q1}`);

  let acc: u32 = 1;
  for (let i = 0; i < 40; i++) {
    acc = acc * 3 + 1;
  }
  console.log(`${acc}`);

  let byte: u8 = 0;
  for (let i = 0; i < 1000; i++) {
    byte = byte + 7;
  }
  console.log(`${byte}`);
  return 0;
}
