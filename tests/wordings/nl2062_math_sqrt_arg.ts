// NL2062: The f64-only `Math` builtins name the type they want rather than the type they got alone.
export const main = (): i32 => {
  const x: f64 = Math.sqrt("a");
  return 0;
};
