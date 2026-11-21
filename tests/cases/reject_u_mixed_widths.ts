// Two unsigned types of different widths do not mix either, exactly as i32 and
// i64 do not; widen explicitly with toU32.
const f = (a: u8, b: u32): u32 => {
  return a * b;
};
