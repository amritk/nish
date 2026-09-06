// 256 does not fit in a u8; the message names the width so the fix is obvious.
function f(): u8 {
  const b: u8 = 256;
  return b;
}
