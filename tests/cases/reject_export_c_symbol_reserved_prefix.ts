// #618: C reserves every file-scope name that begins with `_` for its library
// and start-up code (C11 7.1.3), and the names it uses there cannot be listed
// one by one. An exported `__libc_start_main` replaced the one the start-up
// file's `_start` calls, and an exported `__register_atfork` the one
// `pthread_atfork` calls when a `nish/threads` pool starts: both crashed.
export const __libc_start_main = (): i32 => 1;

export const __register_atfork = (): i32 => 2;

export const main = (): i32 => __libc_start_main() + __register_atfork();
