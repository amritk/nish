// `set` answers nothing, as `TypedArray.prototype.set` answers `undefined`, so
// it is a statement.
export const main = (): i32 => {
  const a: u8[] = [0, 0];
  const b: u8[] = [1];
  const r = a.set(b);
  return 0;
};
