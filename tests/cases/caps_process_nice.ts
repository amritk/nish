// `setNice` and `setIdlePriority` are `process.spawn`, as `kill` is: the
// priority they change is the one the program's children inherit.
export const lower = (): i32 => setNice(19);

export const main = (): number => {
  console.log(lower());
  console.log(setIdlePriority() <= 0);
  return 0;
};
