// `& | ^` and `~` on i32, with negative operands so the two's-complement
// reading is exercised at both ends of the range, plus the compound forms.
function show(a: number, b: number): void {
  console.log(`${a} & ${b} = ${a & b}`);
  console.log(`${a} | ${b} = ${a | b}`);
  console.log(`${a} ^ ${b} = ${a ^ b}`);
}

export function main(): number {
  show(12, 10);
  show(-1, 255);
  show(-16, -3);
  show(2147483647, -2147483648);
  show(0, 0);
  show(-2147483648, -2147483648);
  console.log(~0);
  console.log(~-1);
  console.log(~2147483647);
  console.log(~(-2147483647 - 1));
  console.log(~~12345);
  let x = -1;
  x &= 4095;
  console.log(x);
  x |= 61440;
  console.log(x);
  x ^= 255;
  console.log(x);
  let mask = 0;
  for (let i = 0; i < 32; i++) {
    mask |= 1 << i;
    console.log(mask);
  }
  return 0;
}
