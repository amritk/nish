// `??` defaults a `T | null` or a `Map.get` result; `p` is narrowed to
// `string` here, so there is no `null` for it to replace and Phase 0's refusal
// stands.
// `--compat=nullish` admits it with Node's meaning, the left operand alone.
// It prints the string too, so a run that exits 1 silently is not mistaken
// for this one.
export const main = (): i32 => {
  const p: string | null = "x";
  if (p !== null) {
    console.log(p);
    return (p ?? "y").length;
  }
  return 0;
};
