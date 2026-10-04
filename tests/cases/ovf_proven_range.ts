// Declared ranges prove arithmetic by interval: two `integer<0, 100>` values
// sum to at most 200 and multiply to at most 10000, and `toI32` of a `u8` is
// at most 255, so `hi * 256 + lo` is at most 65535. Every operation here is a
// plain `nsw` one, with no overflow check (src/bounds.ts, "Signed overflow").
export const score = (a: integer<0, 100>, b: integer<0, 100>): i32 => (a + b) * (a - b) + a * b;

export const word = (hi: u8, lo: u8): i32 => toI32(hi) * 256 + toI32(lo);

export const test = (): number => score(7, 3) + word(toU8(1), toU8(2));
