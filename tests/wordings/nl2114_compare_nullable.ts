// NL2114: A nullable operand compares with `null` and nothing else; the message says what to do instead.
export const main = (): i32 => {
  const s: string | null = null;
  const b: boolean = s === "a";
  return 0;
};
