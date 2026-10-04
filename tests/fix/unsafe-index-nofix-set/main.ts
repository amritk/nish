// An array's `set` checks that the source fits at the offset, and `nish:unsafe`
// has no unchecked form of it.
export const place = (dst: u8[], src: u8[], at: i32): void => {
  dst.set(src, at)
}
