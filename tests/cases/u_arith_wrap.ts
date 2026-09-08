// `+ - *` on unsigned types are the same instructions as on signed ones (two's
// complement), so overflow wraps at the width. Each width is exercised at its
// own boundary; the golden pins that neither `nuw` nor `nsw` appears, which is
// true in both overflow modes — unsigned wrapping is defined (WP15 §3), so the
// case needs no `.args` and `--wrapping` would change nothing here.
export function test(): number {
  const b: u8 = 255;
  const h: u16 = 65535;
  const w: u32 = 4294967295;
  const q: u64 = 0;
  const one: u64 = 1;
  console.log(`${b + 1} ${h + 1} ${w + 1} ${q - one}`);
  console.log(`${b * 2} ${h * 3} ${w * 2}`);
  return 0;
}
