// WP15 §2.4: an exported function keeps its check whatever its callers here
// prove, because a host may call it with anything. `first` passes `pick` an
// index it proves, and `arr_range_call_exported.c` then calls `pick(7)`
// itself, which panics with `index out of range: 7 >= 3`.
export const pick = (i: i32): i32 => {
  const xs = [10, 20, 30];
  return xs[i];
};

export const first = (): i32 => pick(1);
