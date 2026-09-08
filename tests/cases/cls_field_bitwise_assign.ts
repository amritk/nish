// `p.f op= e` for the six bitwise operators: one GEP addresses the field, then
// a load, one instruction and a store, exactly as `p.f += e` does. The
// shift-count mask a local gets applies here too (`f.bits <<= 33` is a shift by
// one), and `>>=` still reads the field's signedness: zero-filling on the `u32`,
// sign-filling on the `i32`.
class Flags {
  bits: i32 = 255;
  wide: u32 = 4294967295;
  signed: i32 = -16;
}

export function main(): number {
  const f = new Flags();
  f.bits &= 60;
  f.bits |= 3;
  f.bits ^= 5;
  f.bits <<= 33;
  f.wide >>= 28;
  f.signed >>= 2;
  console.log(f.bits);
  console.log(toI32(f.wide));
  console.log(f.signed);
  return 0;
}
