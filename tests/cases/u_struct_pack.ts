// Narrow widths pack a struct exactly as the C `uint8_t` fields do: four
// bytes then a `u32` is `{ i8, i8, i8, i8, i32 }`, 8 bytes with `code` at
// offset 4, where five `i32` fields would have been 20. A literal assigned to
// a field or an element takes the field's or element's type.
class Pixel {
  r: u8 = 0;
  g: u8 = 0;
  b: u8 = 0;
  a: u8 = 255;
  code: u32 = 0;
}

function test(): number {
  const p = new Pixel();
  p.r = 250;
  p.r += 10; // wraps at 8 bits
  p.code = 4000000000;
  const bytes: u8[] = [1, 2, 250];
  bytes[0] = 255;
  bytes[0] += 1;
  console.log(`${p.r} ${p.a} ${p.code} ${bytes[0]} ${bytes[2]}`);
  return 0;
}
