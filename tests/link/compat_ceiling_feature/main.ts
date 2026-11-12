// NL3057: the root allows the compatibility dialect with no feature, and a
// dependency that asks for one the root does not list is refused by name.
import { twice } from "pkg_loose";

export const main = (): i32 => twice(21) - 42;
