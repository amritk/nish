// `terminalSize` takes nothing: it asks stdout, then stdin.
export const test = (): i32 => terminalSize(1)[0];
