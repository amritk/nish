// WP33 NL8007: `+ - *`, `++` and `--` on u8, u16 and u32 wrap at the width
// here, and TypeScript keeps counting past the range. The compound forms and a
// field target are reported with the operators they stand for.
class Meter {
  hits: u32;

  constructor() {
    this.hits = 4294967295;
  }
}

export const main = (): number => {
  let level: u8 = 250;
  level = level + 10;
  level++;
  let wide: u16 = 3;
  wide = wide - 5;
  const big: u32 = 70000;
  const product: u32 = big * big;
  const meter = new Meter();
  meter.hits += 2;
  let down: u8 = 0;
  --down;
  console.log(toI32(level));
  console.log(toI32(wide));
  console.log(`${product} ${meter.hits}`);
  console.log(toI32(down));
  return 0;
};
