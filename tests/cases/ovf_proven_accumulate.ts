// A bounded accumulation: each of at most 256 passes adds at most 255, so
// `sum` stays below 65281, and each of at most `n` passes adds one to `count`
// — `n` is below 1001 because every caller passes 1000 (src/ranges.ts). Both
// sums are plain `add nsw`, with no overflow check (src/bounds.ts, "Bounded
// accumulation").
export const sumBytes = (buf: u8[]): i32 => {
  if (buf.length < 256) {
    return 0;
  }
  let sum: i32 = 0;
  for (let i: i32 = 0; i < 256; i++) {
    sum = sum + toI32(buf[i]);
  }
  return sum;
};

const countEven = (n: i32): i32 => {
  let count: i32 = 0;
  for (let i: i32 = 0; i <= n; i++) {
    if ((i & 1) === 0) {
      count++;
    }
  }
  return count;
};

export const test = (): number => sumBytes(new Array<u8>(256)) + countEven(1000);
