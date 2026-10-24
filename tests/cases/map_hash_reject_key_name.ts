// The string hash's key is the runtime's `nish_hash_key`, and a program may not
// declare a function of that name to read or replace it.
declare function nish_hash_key(): i32;
export const main = (): i32 => nish_hash_key();
