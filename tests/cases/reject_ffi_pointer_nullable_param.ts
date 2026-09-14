// `null` only from a foreign call (docs/wp27-ffi.md section 3): a C function
// may answer "no address" and may not be handed one, so a pointer is narrowed
// with `!== null` before it goes back. Without this rule a program could pass C
// a null it never got from C, which is what the narrowing was there to stop.
declare function close(open: CPtr | null): void;

export const main = (): i32 => 0;
