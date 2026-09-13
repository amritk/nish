// NL2145: `null` takes its type from context, and the message shows the annotation that gives it one.
export const main = (): i32 => {
  const p = null;
  return 0;
};
