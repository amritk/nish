// `--unchecked-indexing` drops `String.fromBytes`'s range check, as it drops
// `a[i]`'s and `s.slice`'s: what is left is the copy, one `nish_str_new`.
export const cut = (bytes: u8[], start: i32, end: i32): string => String.fromBytes(bytes, start, end);
