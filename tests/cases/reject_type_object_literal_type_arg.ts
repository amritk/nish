// A type argument is a declared name: `Array<{ x: i32 }>` is refused at the `{`.
export const count = (): i32 => {
  const xs: Array<{ x: i32 }> = [];
  return xs.length;
};
