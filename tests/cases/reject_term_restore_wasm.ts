// `setTerminalRestore` on a freestanding wasm32 build, whose runtime has no
// terminal to leave. The wasi profile accepts it.
export const test = (): i32 => setTerminalRestore("\u001b[?25h");
