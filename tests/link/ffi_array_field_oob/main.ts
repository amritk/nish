// WP66 S4: a constant index outside a fixed-length array field is refused at
// compile time, past the end and below zero alike, for a read and a write.
declare class Ctx {
  h: Record<integer<0, 4>, u32>
}

export const main = (): i32 => {
  const c = new Ctx()
  c.h[5] = 1
  return toI32(c.h[-1])
}
