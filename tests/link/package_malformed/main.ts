// WP21 S3: a manifest that is not JSON (`docs/wp21-packages.md` §10b).
//
// The comma after `"version"` is missing. The narrow reader stops at the first
// thing it cannot read past, so it never reaches `exports` and finds no entry
// point — and saying that the package has no Nish entry point would send its
// author to a condition that is correct. The message names the manifest and the
// place it breaks instead.
import { seed } from "pkg_broken";

export const main = (): i32 => seed();
