// WP66 S7: a source path that is not printable ASCII is refused (NL3060): the
// manifest decoder would collapse `é` and `ê` to one byte, so two paths would meet.
export const main = (): i32 => 0
