// `readStdin` reads bytes, so its buffer is a `u8[]`.
export const fill = (b: i32[]): i32 => readStdin(b, 0, 1);
