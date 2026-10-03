// --deny-panics refuses a call to `panic`, which nothing proves away.
export const check = (ok: boolean): i32 => {
  if (!ok) {
    panic("not ok");
  }
  return 1;
};
