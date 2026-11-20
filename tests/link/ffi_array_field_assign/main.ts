// WP66 S4: a fixed-length array field is written element by element; a whole
// array cannot be stored over it.
declare class Ctx {
  h: Record<integer<0, 4>, u32>
}

export const main = (): i32 => {
  const c = new Ctx()
  c.h = [1, 2, 3, 4, 5]
  return 0
}
