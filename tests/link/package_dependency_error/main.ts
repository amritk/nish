// WP21 S3: the type error is in `pkg_broken`'s own source, so the report says
// it is the dependency's, and `--json` carries its name in `package`.
import { twice } from "pkg_broken";

export const main = (): i32 => twice(21);
