import { loadU8x16, store } from "nish:simd"

export const copy16 = (src: u8[], dst: u8[], at: i32): void => {
  store(loadU8x16(src, at), dst, at)
}
