// NL2260: the empty statement `;` is refused in a body, named by its syntax
// kind as every statement kind with no checker is.
export const main = (): i32 => {
  let n: i32 = 1;
  ;
  return n;
};
