// `package_two_dirs` with the nested copy's manifest declaring no `version`,
// which npm allows for a package that is never published. The refusal still
// names both directories, and says of that copy that it has no version rather
// than printing an empty pair of parentheses.
import { digest } from "hash";
import { user } from "user";

export const main = (): i32 => digest() + user();
