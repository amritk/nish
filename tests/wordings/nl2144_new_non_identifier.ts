// NL2144: `new` takes a class name, so a qualified expression is refused before it is resolved.
export const main = (): i32 => {
  const p = new a.B();
  return 0;
};
