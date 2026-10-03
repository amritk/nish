// #386: nor is there a user to ask about on a wasm32 build.
export const me = (): i64 => geteuid();
