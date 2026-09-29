// WP33 NL8006: `/` on an integer is `sdiv` or `udiv` here, which truncates
// towards zero, and a double division under TypeScript, which keeps the
// fraction. Every integer width is reported, `/=` with `/`, and a ranged value
// divides as its base, i32.
const half = (n: i32): i32 => n / 2;

const third = (percent: integer<0, 100>): i32 => percent / 3;

export const main = (): number => {
  let bytes: u8 = 200;
  bytes = bytes / 3;
  let count: u32 = 10;
  count /= 4;
  console.log(half(7));
  console.log(third(50));
  console.log(toI32(toI64(7) / toI64(2)));
  console.log(toI32(bytes) + toI32(count));
  return 0;
};
