// `netWrite2` sends bytes from two `u8[]`s; its first buffer is checked as
// its second is, so an `i32[]` there is refused, not sent as its bytes.
export const main = (): number => {
  const head: i32[] = [1, 2];
  const body: u8[] = [3, 4];
  return netWrite2(1, head, 0, 2, body, 0, 2);
};
