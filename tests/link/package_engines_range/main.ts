// WP21 S3: an `engines.nish` range this compiler does not read
// (`docs/wp21-packages.md` §6).
//
// The one range accepted is a floor, `>=X.Y.Z` or `>=X.Y`. A caret range is
// refused rather than guessed at, because a floor this compiler cannot read is
// one it cannot claim to meet — so a shape it does not understand is never
// silently treated as satisfied.
import { seed } from "pkg_caret";

export const main = (): i32 => seed();
