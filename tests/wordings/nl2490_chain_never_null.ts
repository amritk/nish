// NL2490: `?.` on a receiver that cannot be `null`.
export const f = (s: string): i32 => s?.length ?? 0;
