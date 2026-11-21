// WP66 S4: fixed-length arrays do not open C bitfields. A field narrower than
// its storage, C's `unsigned flags : 3`, stays refused.
declare class Ctx {
  h: Record<integer<0, 4>, u32>
  flags: integer<0, 7>
}

export const main = (): i32 => 0
