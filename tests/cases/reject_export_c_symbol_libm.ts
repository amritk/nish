// #618: `Math.sin` lowers to `llvm.sin.f64`, which LLVM turns into a call to
// the C library's `sin`, so an exported `sin` is the definition that call
// binds to: natively the program printed 42 where Node printed `sin(x)`.
export const sin = (x: f64): f64 => x + 42;

export const main = (): i32 => toI32(sin(1) + Math.sin(toF64(process.argv.length)));
