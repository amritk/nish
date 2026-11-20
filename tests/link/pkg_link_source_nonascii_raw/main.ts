// WP66 S7: a source path written with a raw UTF-8 character that is not
// printable ASCII is refused (NL3060). The decoder keeps a raw character as it
// is, so this spelling never collided; the escaped spelling that did is
// tests/link/pkg_link_source_nonascii (docs/security/package-link.md, PL-F1).
export const main = (): i32 => 0
