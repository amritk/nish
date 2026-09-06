// The same seven operators at 64 bits, where JavaScript needs BigInt: its
// shifts do not mask the count and it has no `>>>` at all, so the rewrite
// routes these through the shim rather than through a JS operator.
export function main(): number {
  const one: i64 = 1;
  const neg: i64 = -1;
  for (let n: i64 = 0; n < 70; n = n + 1) {
    console.log(one << n);
  }
  console.log(neg >> 8);
  console.log(neg >>> 8);
  console.log(neg >>> 63);
  console.log(neg << 63);
  const big: i64 = 9007199254740992;
  console.log(big & 4294967295);
  console.log(big | 255);
  console.log(big ^ big);
  console.log(~big);
  console.log(~neg);
  let acc: i64 = 1;
  for (let i: i64 = 0; i < 24; i = i + 1) {
    acc = (acc << 7) ^ (acc >> 3);
    console.log(acc);
    console.log(acc >>> 40);
  }
  let bits: i64 = 0;
  bits |= 255;
  bits <<= 32;
  bits ^= 4095;
  bits >>= 4;
  bits >>>= 2;
  bits &= 1048575;
  console.log(bits);
  return 0;
}
