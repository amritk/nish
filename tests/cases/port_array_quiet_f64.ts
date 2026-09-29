// WP33 NL8005 under --number-mode f64, where a length can be spelled `0.0`:
// it is still the zero that leaves no element to differ, so nothing may warn.
export const main = (): i32 => {
  const none = new Array<f64>(0.0);
  const flags = new Array<boolean>(0e0);
  console.log(none.length + flags.length);
  return 0;
};
