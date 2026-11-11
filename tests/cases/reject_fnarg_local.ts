// WP51: a local may have a function type, but a reference has no zero value
// to start from, so it is initialised where it is declared.
export const main = (): i32 => {
  let g: (x: i32) => i32;
  return 0;
};
