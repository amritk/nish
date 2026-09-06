// `<< >> >>>` on i32: sign-filling versus zero-filling, and counts at, above
// and below the 32-bit width. JavaScript masks the count to 5 bits and so do
// we, which is what keeps this program comparable at all.
function row(a: number, n: number): void {
  console.log(`${a} << ${n} = ${a << n}`);
  console.log(`${a} >> ${n} = ${a >> n}`);
  console.log(`${a} >>> ${n} = ${a >>> n}`);
}

export function main(): number {
  for (let n = 0; n < 40; n++) {
    row(-16, n);
  }
  row(1, 31);
  row(1, 32);
  row(1, 33);
  row(-16, -1);
  row(-1, 0);
  row(-1, 1);
  row(2147483647, 1);
  row(-2147483648, 1);
  row(0, 7);
  console.log(1 << 32);
  console.log(1 << 33);
  console.log(-1 >>> 0);
  let x = 1;
  x <<= 40;
  console.log(x);
  x = -256;
  x >>= 4;
  console.log(x);
  x = -256;
  x >>>= 4;
  console.log(x);
  return 0;
}
