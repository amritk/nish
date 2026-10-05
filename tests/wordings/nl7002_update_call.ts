// NL7002: a compound store whose right side calls has no rewrite, because the
// rewrite evaluates the array and the index twice.
const next = (k: i32): i32 => k + 1;

export const bump = (xs: i32[], k: i32): void => {
  xs[k] += next(k);
};
