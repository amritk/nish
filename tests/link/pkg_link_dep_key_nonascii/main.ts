// WP66 S7: a package name under `nish.link.dependencies` spelled with a `\u`
// escape that is not printable ASCII is refused (NL3060): the decoder turns it
// into DEL, so `"pkg_m\u00fcl"` and `"pkg_m\u00f6l"` would grant one package
// (docs/security/package-link.md, PL-F1).
export const main = (): i32 => 0
