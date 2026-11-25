// --deny-panics refuses `dst.set(src, at)` at an offset other than 0: no fact
// says `at + src.length <= dst.length`, so the check stays, and the advice
// names the copy from 0 that a length guard proves.
export const put = (dst: u8[], src: u8[], at: i32): void => {
  if (at >= 0 && src.length <= dst.length) {
    dst.set(src, at);
  }
};
