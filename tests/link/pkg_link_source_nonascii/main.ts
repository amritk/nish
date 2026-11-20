// WP66 S7: a source path spelled with a `\u` escape of a character that is not
// printable ASCII is refused (NL3060). The manifest decoder turns every such
// escape into one byte, DEL, so `"c/\u00e9.c"` and `"c/\u00ea.c"`
// would read as the same path (docs/security/package-link.md, PL-F1).
export const main = (): i32 => 0
