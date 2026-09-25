// WP32: a `let` holds no `V | undefined` however it is annotated; it gets the unannotated `let`'s rewrite.
export const main = (): i32 => {
  const m = new Map<string, i32>();
  let g: i32 | undefined = m.get("a");
  return 0;
};
