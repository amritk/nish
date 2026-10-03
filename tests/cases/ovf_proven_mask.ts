// A mask bounds what it writes, at every pass of a loop: `h` is only ever
// assigned `(...) & 0xffff`, so it is in [0, 65535] at the top of each pass,
// and `h * 31 + c` with `c` a byte fits — a hash folded into a table size
// needs no overflow check (src/bounds.ts, "Signed overflow").
export const hash16 = (bytes: u8[]): i32 => {
  let h: i32 = 0;
  for (const b of bytes) {
    h = (h * 31 + toI32(b)) & 0xffff;
  }
  return h;
};

export const test = (): number => hash16([toU8(104), toU8(105)]);
