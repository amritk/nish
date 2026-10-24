// `readStdin` writes into its buffer, so a `readonly u8[]` is refused.
export const fill = (b: readonly u8[]): i32 => readStdin(b, 0, 1);
