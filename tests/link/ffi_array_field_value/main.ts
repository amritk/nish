// WP66 S4: a fixed-length array field is read and written by index only. It
// is C's `uint32_t h[5]` inside its object, not a Nish array, so holding it,
// measuring it, walking it or passing it is refused at each site.
declare class Ctx {
  h: Record<integer<0, 4>, u32>
}

const count = (xs: u32[]): i32 => xs.length

export const main = (): i32 => {
  const c = new Ctx()
  const held = c.h
  const n = c.h.length
  for (const x of c.h) {
    n + x
  }
  return count(c.h)
}
