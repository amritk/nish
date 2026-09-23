// WP21 S3: a `nish` condition nested inside another condition
// (`docs/wp21-packages.md` §11). The reader does not follow a nested condition
// object, so it has no file to compile; but the entry may well declare `nish`
// one level down, so this must not be the "declares none of the conditions"
// refusal, which would send the author to a row that is there. It is the
// general answer instead.
import { seed } from "pkg_nested";

export const main = (): i32 => seed();
