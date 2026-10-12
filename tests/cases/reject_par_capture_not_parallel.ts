// Only the data-parallel forms' arrows capture: any other function argument
// still reads only its parameters and the module's top-level names.
const apply = (f: (x: i32) => i32, v: i32): i32 => f(v);

export const main = (): i32 => {
  const k: i32 = 3;
  return apply((x) => x + k, 1);
};
