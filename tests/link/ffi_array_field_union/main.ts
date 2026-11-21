// WP66 S4: fixed-length arrays do not open C unions. A field that is one of
// two scalars, C's `union { uint32_t u; float f; }`, stays refused.
declare class Ctx {
  h: Record<integer<0, 4>, u32>
  either: u32 | f32
}

export const main = (): i32 => 0
