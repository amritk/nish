// A number has no `toString` (#1632): the refusal names the template literal
// that converts it, spelled with the receiver the program wrote.
export const main = (): i32 => {
  const count: i32 = 7;
  console.log(count.toString());
  return 0;
};
