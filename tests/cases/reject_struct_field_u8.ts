// The same rule with no flag in sight: an object literal's property value gets
// no contextual numeric type, so `255` is an `i32` and the `u8` field refuses
// it — `toU8(255)` is the way to write it. stage1 compiled this program while
// stage0 refused it, in the default mode, which is what makes the object
// literal's field the interesting half of WP19 §A2's contextual-type row.
interface Pixel {
  b: u8;
}

export function main(): i32 {
  const p: Pixel = { b: 255 };
  return toI32(p.b);
}
