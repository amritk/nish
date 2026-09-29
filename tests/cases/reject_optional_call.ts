// `?.` before a call is the same refusal as before a member.
export const run = (s: string): i32 => s.charCodeAt?.(0)
