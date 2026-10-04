// NL7002: `uncheckedSet` is a statement, and this store's value is returned.
export const put = (xs: i32[], k: i32, v: i32): i32 => {
  return (xs[k] = v);
};
