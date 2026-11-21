// An arrow expression's parameters take no default.
export const main = (): void => {
  const xs = [1, 2]
  console.log(xs.map((x: i32, i: i32 = 0): i32 => x + i).length)
};
