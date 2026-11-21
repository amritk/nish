// WP66 S4: the key of a fixed-length array field spells its length: it is
// `integer<0, Hi>`. A range that does not start at 0, a key that is not an
// integer range, and a length past the cap are each refused.
declare class FromOne {
  a: Record<integer<1, 4>, u32>
}

declare class Named {
  b: Record<string, u32>
}

declare class TooLong {
  c: Record<integer<0, 16777216>, u8>
}

export const main = (): i32 => 0
